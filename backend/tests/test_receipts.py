"""Распознавание чеков: загрузка, проверки файла, коды ошибок, скачивание. OCR подменяется фиксированным текстом;
один тест прогоняет настоящий Tesseract и пропускается, если он не установлен."""
from datetime import date
from io import BytesIO

import pytest
from PIL import Image

from app import receipt_ocr
from app.config import settings
from tests.fixtures.make_receipts import find_font, render_receipt

RECEIPT_TEXT = "ООО «Вокзал»\nДата 12.10.2026 09:15\nИТОГО =1 234,50"


def png_bytes(size=(200, 120)) -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, "white").save(buf, "PNG")
    return buf.getvalue()


@pytest.fixture(autouse=True)
def uploads(tmp_path, monkeypatch):
    """Файлы чеков в тестах пишутся во временную папку."""
    monkeypatch.setattr(settings, "upload_dir", tmp_path)
    return tmp_path


@pytest.fixture()
def fake_ocr(monkeypatch):
    def _set(text=RECEIPT_TEXT):
        monkeypatch.setattr(receipt_ocr, "extract_text", lambda image: text)

    _set()
    return _set


@pytest.fixture()
def alice(create_user):
    return create_user("employee", "alice@example.com", "Алиса")


@pytest.fixture()
def bob(create_user):
    return create_user("employee", "bob@example.com", "Боб")


def upload(client, data=None, content_type="image/png", name="photo.png"):
    return client.post("/receipts/recognize", files={"file": (name, data if data is not None else png_bytes(), content_type)})


# ---------- распознавание ----------
def test_requires_login(anon, fake_ocr):
    assert upload(anon).status_code == 401
    assert anon.get("/receipts/status").status_code == 401


def test_status_reports_availability(client, monkeypatch):
    monkeypatch.setattr(receipt_ocr, "ocr_status", lambda: (True, ["rus", "eng"]))
    assert client.get("/receipts/status").json() == {"available": True, "languages": ["rus", "eng"]}
    monkeypatch.setattr(receipt_ocr, "ocr_status", lambda: (False, []))
    assert client.get("/receipts/status").json() == {"available": False, "languages": []}


def test_successful_recognition_saves_file_but_not_expense(client, fake_ocr, uploads, Session):
    r = upload(client, name="../../secret.png")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount"] == "1234.50" and body["expense_date"] == "2026-10-12" and body["recognized"] is True
    assert receipt_ocr.RECEIPT_URL.fullmatch(body["receipt_url"]) and body["receipt_url"].endswith(".png")
    assert "secret" not in body["receipt_url"]  # имя файла от клиента не используется
    assert (uploads / body["receipt_url"]).is_file()
    assert "text" not in body and "ООО" not in r.text  # сырой текст не возвращается
    assert client.get("/expenses").json() == []  # расход автоматически не создаётся


def test_real_format_decides_extension(client, fake_ocr):
    buf = BytesIO()
    Image.new("RGB", (50, 50), "white").save(buf, "JPEG")
    r = upload(client, buf.getvalue(), content_type="image/png")  # заголовок врёт — смотрим содержимое
    assert r.status_code == 200 and r.json()["receipt_url"].endswith(".jpg")


def test_nothing_found_is_not_an_error(client, fake_ocr):
    fake_ocr("Спасибо за покупку!")
    r = upload(client)
    assert r.status_code == 200
    body = r.json()
    assert body["recognized"] is False and body["amount"] is None and body["expense_date"] is None
    assert body["message"] == "Не удалось распознать сумму и дату, введите вручную."


def test_partial_result_message(client, fake_ocr):
    fake_ocr("ИТОГО 500,00")
    assert upload(client).json()["message"].startswith("Найдена только сумма")


def test_unsupported_type_415(client, fake_ocr):
    assert upload(client, b"%PDF-1.4", content_type="application/pdf", name="a.pdf").status_code == 415
    buf = BytesIO()
    Image.new("RGB", (20, 20)).save(buf, "GIF")
    assert upload(client, buf.getvalue(), content_type="image/png").status_code == 415  # реальный формат GIF


def test_not_an_image_422(client, fake_ocr):
    r = upload(client, b"definitely not an image", content_type="image/png")
    assert r.status_code == 422 and r.json()["detail"] == "Файл не является изображением"


def test_too_large_413(client, fake_ocr, monkeypatch):
    monkeypatch.setattr(settings, "max_receipt_mb", 0.001)  # ~1 КБ
    r = upload(client, png_bytes((800, 800)) + b"0" * 2048)
    assert r.status_code == 413


def test_pixel_bomb_413(client, fake_ocr, monkeypatch):
    monkeypatch.setattr(receipt_ocr, "MAX_PIXELS", 100)
    assert upload(client, png_bytes((50, 50))).status_code == 413


def test_ocr_unavailable_503(client, monkeypatch):
    def unavailable(image):
        raise receipt_ocr.OcrUnavailable("Распознавание недоступно на сервере, введите данные вручную")

    monkeypatch.setattr(receipt_ocr, "extract_text", unavailable)
    r = upload(client)
    assert r.status_code == 503 and "недоступно" in r.json()["detail"]


def test_accountant_cannot_upload(client_for, accountant, fake_ocr):
    assert upload(client_for(accountant)).status_code == 403


def test_preparation_upscales_and_converts():
    image = receipt_ocr.prepare(Image.new("RGB", (400, 200), "white"))
    assert image.mode == "L" and image.width == 1000


# ---------- скачивание файла чека ----------
@pytest.fixture()
def alice_expense(client, client_for, alice, make_budget, make_trip, fake_ocr):
    c = client_for(alice)
    trip = make_trip("10000.00", user=alice, budget=make_budget())
    receipt_url = upload(c).json()["receipt_url"]
    r = c.post("/expenses", json={"trip_id": trip["id"], "category": "meals", "description": "Обед", "amount": "1234.50",
                                  "expense_date": "2026-10-12", "receipt_url": receipt_url})
    assert r.status_code == 201, r.text
    return r.json()


def test_owner_and_staff_download_receipt(client, client_for, alice, alice_expense):
    r = client_for(alice).get(f"/expenses/{alice_expense['id']}/receipt")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.content == png_bytes()
    assert client.get(f"/expenses/{alice_expense['id']}/receipt").status_code == 200  # руководитель


def test_foreign_employee_gets_404(client_for, bob, alice_expense):
    assert client_for(bob).get(f"/expenses/{alice_expense['id']}/receipt").status_code == 404


@pytest.mark.parametrize("bad_url", ["receipts/1.jpg", "receipts/../../.env", "../app/config.py", "receipts/" + "a" * 32 + ".exe", None])
def test_unsafe_or_legacy_receipt_url_404(client, client_for, alice, alice_expense, bad_url):
    client_for(alice).patch(f"/expenses/{alice_expense['id']}", json={"receipt_url": bad_url})
    r = client.get(f"/expenses/{alice_expense['id']}/receipt")
    assert r.status_code == 404 and r.json()["detail"] == "Файл чека недоступен"


def test_missing_file_404(client, alice_expense, uploads):
    (uploads / alice_expense["receipt_url"]).unlink()
    assert client.get(f"/expenses/{alice_expense['id']}/receipt").status_code == 404


# ---------- настоящий Tesseract ----------
def _real_ocr_ready() -> bool:
    available, langs = receipt_ocr.ocr_status()
    return available and "rus" in langs and find_font() is not None


@pytest.mark.skipif(not _real_ocr_ready(), reason="Tesseract с языком rus не установлен (или нет шрифта с кириллицей)")
def test_real_tesseract_end_to_end(client):
    today = date.today()
    image = render_receipt(["ООО «Тест»", f"Дата {today:%d.%m.%Y}", "Обед 1 234,50", "ИТОГО 1 234,50"])
    buf = BytesIO()
    image.save(buf, "PNG")
    r = upload(client, buf.getvalue())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["amount"] == "1234.50" and body["expense_date"] == today.isoformat() and body["recognized"] is True
