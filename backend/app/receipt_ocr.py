"""Распознавание чека: проверка файла, подготовка изображения, Tesseract и сохранение файла.

Tesseract — внешняя программа; если её нет, приложение работает как раньше, только распознавание недоступно (503).
Распознанный текст не сохраняется и не пишется в лог: в нём могут быть личные данные.
"""
import re
import uuid
from io import BytesIO
from pathlib import Path

import pytesseract
from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

# Реальный формат файла (по содержимому, а не по имени) → расширение для сохранения.
FORMATS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MEDIA_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}
MAX_PIXELS = 40_000_000  # ~40 Мпикс: защита от «бомб» распаковки (маленький файл → гигантская картинка)
MIN_OCR_WIDTH = 1000  # мелкие картинки Tesseract читает плохо — увеличиваем
RECEIPT_URL = re.compile(r"^receipts/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$")

Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # Pillow сам откажется открывать больше (DecompressionBombError)


class ReceiptError(Exception):
    """Ошибка загрузки чека с HTTP-статусом (обработчик в main.py)."""

    status_code = 400

    def __init__(self, message: str):
        super().__init__(message)


class ReceiptTooLarge(ReceiptError):
    status_code = 413


class ReceiptUnsupported(ReceiptError):
    status_code = 415


class ReceiptNotImage(ReceiptError):
    status_code = 422


class OcrUnavailable(ReceiptError):
    status_code = 503


def _configure() -> None:
    if settings.tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd


def requested_languages() -> list[str]:
    return [l for l in settings.ocr_langs.split("+") if l]


def ocr_status() -> tuple[bool, list[str]]:
    """(доступно ли распознавание, языки из OCR_LANGS, установленные в Tesseract)."""
    _configure()
    try:
        installed = set(pytesseract.get_languages(config=""))
    except (pytesseract.TesseractNotFoundError, pytesseract.TesseractError, OSError):
        return False, []
    langs = [l for l in requested_languages() if l in installed]
    return bool(langs), langs


def max_bytes() -> int:
    return int(settings.max_receipt_mb * 1024 * 1024)


def load_image(data: bytes, content_type: str | None) -> tuple[Image.Image, str]:
    """Проверяет файл и открывает изображение. Возвращает (изображение, расширение по реальному формату)."""
    if len(data) > max_bytes():
        raise ReceiptTooLarge(f"Файл больше {settings.max_receipt_mb:g} МБ")
    if (content_type or "").split(";")[0].strip().lower() not in CONTENT_TYPES:
        raise ReceiptUnsupported("Поддерживаются только изображения JPEG, PNG и WEBP")
    try:
        probe = Image.open(BytesIO(data))  # читает только заголовок, картинку ещё не распаковывает
        fmt, (width, height) = probe.format, probe.size
    except Image.DecompressionBombError as exc:
        raise ReceiptTooLarge("Слишком большое изображение") from exc
    except (UnidentifiedImageError, OSError) as exc:
        raise ReceiptNotImage("Файл не является изображением") from exc
    if fmt not in FORMATS:
        raise ReceiptUnsupported("Поддерживаются только изображения JPEG, PNG и WEBP")
    if width * height > MAX_PIXELS:
        raise ReceiptTooLarge("Слишком большое изображение")
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Image.DecompressionBombError as exc:
        raise ReceiptTooLarge("Слишком большое изображение") from exc
    except (OSError, ValueError) as exc:
        raise ReceiptNotImage("Файл повреждён или не является изображением") from exc
    return image, FORMATS[fmt]


def prepare(image: Image.Image) -> Image.Image:
    """Подготовка для OCR: поворот по EXIF (фото с телефона), оттенки серого, контраст, увеличение мелких."""
    image = ImageOps.exif_transpose(image)
    image = ImageOps.autocontrast(image.convert("L"))
    if image.width < MIN_OCR_WIDTH:
        factor = min(3.0, MIN_OCR_WIDTH / image.width)
        image = image.resize((round(image.width * factor), round(image.height * factor)), Image.Resampling.LANCZOS)
    return image


def extract_text(image: Image.Image) -> str:
    """Запуск Tesseract. Отдельная функция, чтобы в тестах её можно было подменить фиксированным текстом."""
    _configure()
    available, langs = ocr_status()
    if not available:
        raise OcrUnavailable("Распознавание недоступно на сервере, введите данные вручную")
    try:
        return pytesseract.image_to_string(image, lang="+".join(langs), timeout=settings.ocr_timeout_seconds)
    except pytesseract.TesseractNotFoundError as exc:
        raise OcrUnavailable("Распознавание недоступно на сервере, введите данные вручную") from exc
    except RuntimeError as exc:  # pytesseract сообщает о превышении timeout через RuntimeError
        raise OcrUnavailable("Распознавание заняло слишком много времени, введите данные вручную") from exc
    except pytesseract.TesseractError as exc:
        raise OcrUnavailable("Не удалось выполнить распознавание, введите данные вручную") from exc


def save_receipt(data: bytes, ext: str) -> str:
    """Сохраняет исходный файл под случайным именем. Имя файла от клиента не используется никогда."""
    folder = settings.upload_dir / "receipts"
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.{ext}"
    (folder / name).write_bytes(data)
    return f"receipts/{name}"


def receipt_path(receipt_url: str | None) -> Path | None:
    """Путь к файлу чека или None, если ссылка не наша (старые условные имена, попытки ../) или файла нет."""
    if not receipt_url or not RECEIPT_URL.fullmatch(receipt_url):
        return None
    root = settings.upload_dir.resolve()
    path = (root / receipt_url).resolve()
    if root not in path.parents or not path.is_file():
        return None
    return path


def media_type(path: Path) -> str:
    return MEDIA_TYPES[path.suffix.lstrip(".").lower()]
