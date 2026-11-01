from fastapi import APIRouter, Depends, File, UploadFile

from app import permissions, receipt_ocr, schemas
from app.deps import CurrentUser, get_current_user
from app.permissions import EXPENSE_WRITERS
from app.receipt_parser import parse_receipt

router = APIRouter(prefix="/receipts", tags=["receipts"], dependencies=[Depends(get_current_user)])


def _message(amount_found: bool, date_found: bool) -> str:
    if amount_found and date_found:
        return "Сумма и дата подставлены из чека. Проверьте их перед сохранением."
    if amount_found:
        return "Найдена только сумма. Дату введите вручную."
    if date_found:
        return "Найдена только дата. Сумму введите вручную."
    return "Не удалось распознать сумму и дату, введите вручную."


@router.get("/status", response_model=schemas.ReceiptStatus)
def receipt_status():
    """Доступно ли распознавание: frontend отключает загрузку фото, если Tesseract не установлен."""
    available, languages = receipt_ocr.ocr_status()
    return schemas.ReceiptStatus(available=available, languages=languages)


@router.post("/recognize", response_model=schemas.ReceiptRecognition)
def recognize_receipt(actor: CurrentUser, file: UploadFile = File(...)):
    """Распознаёт сумму и дату на фото чека и сохраняет файл. Расход НЕ создаётся: человек проверяет и сохраняет сам.

    Обычная (не async) функция: FastAPI выполнит её в пуле потоков, и долгий Tesseract не заблокирует сервер.
    """
    permissions.require_role(actor, *EXPENSE_WRITERS)
    data = file.file.read(receipt_ocr.max_bytes() + 1)  # читаем не больше лимита + 1 байт
    image, ext = receipt_ocr.load_image(data, file.content_type)
    text = receipt_ocr.extract_text(receipt_ocr.prepare(image))
    parsed = parse_receipt(text)
    receipt_url = receipt_ocr.save_receipt(data, ext)
    return schemas.ReceiptRecognition(
        receipt_url=receipt_url,
        amount=parsed.amount,
        expense_date=parsed.expense_date,
        recognized=parsed.recognized,
        message=_message(parsed.amount is not None, parsed.expense_date is not None),
    )
