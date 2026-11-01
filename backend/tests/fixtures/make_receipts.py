"""Синтетические «чеки» для тестов и проверки точности распознавания. Настоящих чеков и личных данных нет.

    python -m tests.fixtures.make_receipts           # пересоздать PNG в этой папке
    python -m tests.fixtures.make_receipts --check   # прогнать PNG через Tesseract и вывести таблицу точности

Запуск из папки backend (с активированным venv).
"""
import random
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = Path(__file__).resolve().parent
FONT_CANDIDATES = [
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/Library/Fonts/Arial.ttf",
]


def find_font() -> str | None:
    """Масштабируемый шрифт с кириллицей (встроенный шрифт Pillow кириллицу не содержит)."""
    return next((f for f in FONT_CANDIDATES if Path(f).is_file()), None)


def render_receipt(lines: list[str], *, rotate: float = 0, noise: bool = False, size: int = 34) -> Image.Image:
    font_path = find_font()
    if font_path is None:
        raise RuntimeError("Не найден шрифт с кириллицей (Arial или DejaVu Sans)")
    font = ImageFont.truetype(font_path, size)
    line_h = int(size * 1.6)
    image = Image.new("L", (760, 60 + line_h * len(lines)), 255)
    draw = ImageDraw.Draw(image)
    for i, line in enumerate(lines):
        draw.text((40, 30 + i * line_h), line, font=font, fill=0)
    if noise:
        rnd = random.Random(42)  # фиксированное зерно: картинка одинаковая при каждом запуске
        pixels = image.load()
        for _ in range(image.width * image.height // 40):
            x, y = rnd.randrange(image.width), rnd.randrange(image.height)
            pixels[x, y] = rnd.choice((0, 90, 170, 255))
        image = image.filter(ImageFilter.GaussianBlur(0.8))
    if rotate:
        image = image.rotate(rotate, expand=True, fillcolor=255, resample=Image.Resampling.BICUBIC)
    return image


# Имя файла → (строки чека, параметры, ожидаемая сумма, ожидаемая дата)
RECEIPTS = {
    "receipt_clean.png": (
        ["ООО «Вокзал»", "КАССОВЫЙ ЧЕК № 0042", "Дата 12.10.2026 09:15", "Билет Москва — Казань", "1 x 1 234,50", "ИТОГО =1 234,50"],
        {}, "1234.50", date(2026, 10, 12),
    ),
    "receipt_tilted.png": (
        ["Гостиница «Север»", "Чек № 118 от 03.09.2026", "Проживание 2 ночи", "К ОПЛАТЕ: 3 450,00 руб"],
        {"rotate": 2.5}, "3450.00", date(2026, 9, 3),
    ),
    "receipt_noisy.png": (
        ["Кафе «Обед»", "05.10.2026 13:40", "Суп 320,00", "Второе 460,00", "ИТОГО 780,00"],
        {"noise": True}, "780.00", date(2026, 10, 5),
    ),
    "receipt_no_total.png": (
        ["Спасибо за покупку!", "Ждём вас снова", "Сохраните этот чек"],
        {}, None, None,
    ),
}


def generate() -> None:
    for name, (lines, opts, _, _) in RECEIPTS.items():
        render_receipt(lines, **opts).save(HERE / name, optimize=True)
        print("saved", name, (HERE / name).stat().st_size, "bytes")


def check() -> None:
    """Таблица точности: картинка → ожидаемое → распознано (нужен установленный Tesseract)."""
    from app import receipt_ocr
    from app.receipt_parser import parse_receipt

    available, langs = receipt_ocr.ocr_status()
    if not available:
        print("Tesseract не установлен или нет нужных языков — проверка невозможна")
        return
    print(f"Языки: {'+'.join(langs)}")
    print("| Картинка | Ожидаемая сумма | Распознана | Ожидаемая дата | Распознана |")
    print("|---|---|---|---|---|")
    for name, (_, _, amount, day) in RECEIPTS.items():
        data = (HERE / name).read_bytes()
        image, _ = receipt_ocr.load_image(data, "image/png")
        parsed = parse_receipt(receipt_ocr.extract_text(receipt_ocr.prepare(image)), today=date(2026, 11, 1))
        mark = lambda got, want: f"{got or '—'} {'✓' if str(got or None) == str(want) else '✗'}"
        print(f"| {name} | {amount or '—'} | {mark(parsed.amount, amount)} | {day or '—'} | {mark(parsed.expense_date, day)} |")


if __name__ == "__main__":
    check() if "--check" in sys.argv else generate()
