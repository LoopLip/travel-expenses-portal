"""Разбор текста чека (без Tesseract): сумма и дата из типичных и «испорченных» распознаванием текстов."""
from datetime import date
from decimal import Decimal

import pytest

from app.receipt_parser import fix_ocr_digits, parse_amount, parse_date, parse_receipt

TODAY = date(2026, 11, 1)

AMOUNT_CASES = [
    ("ООО «Ромашка»\nКофе 250,00\nКруассан 180,00\nИТОГО 430,00", "430.00"),
    ("Сапсан\nСУММА ПО ЧЕКУ\n=7 400,00", "7400.00"),  # сумма строкой ниже ключевого слова
    ("Гостиница «Север»\nПроживание 3 ночи\nК ОПЛАТЕ: 21 600.00 руб", "21600.00"),
    ("TAXI\nTOTAL 1234.50 RUB", "1234.50"),
    ("Обед 300-00\nУжин 450-00\nВСЕГО 750-00", "750.00"),  # копейки через дефис
    ("ИТОГО 1234,5", "1234.50"),  # одна цифра копеек
    ("Итого =1500", "1500.00"),  # целое число рядом с ключевым словом
    ("ИТОГО 1 2З4,50".replace("З", "3"), "1234.50"),
    ("ИТОГО 1O5,OO", "105.00"),  # OCR: буква О вместо нуля внутри числа
    ("ИТОГО l25,50", "125.50"),  # OCR: l вместо 1
    ("ИTОГO 99,90", "99.90"),  # латинские T и O в ключевом слове
    ("Товар 1 100,00\nТовар 2 50,00\nСУММА НДС 20% 25,00\nИТОГО 150,00", "150.00"),  # НДС не итог
    ("Позиция 120,00\nПозиция 75,50\nКАРТА ****1234", "120.00"),  # без ключевых слов — наибольшая с копейками
    ("ИТОГО 1 234,50\nНАЛИЧНЫМИ 2 000,00\nСДАЧА 765,50", "1234.50"),
    ("Дата 12.10.2026 14:35\nИТОГО 450,00", "450.00"),  # дата и время не принимаются за сумму
]


@pytest.mark.parametrize("text,expected", AMOUNT_CASES)
def test_amount(text, expected):
    assert parse_amount(text) == Decimal(expected)


@pytest.mark.parametrize(
    "text",
    [
        "Спасибо за покупку!\nПриходите ещё",
        "ИТОГО 0,00",  # нулевая сумма
        "ИТОГО 99999999999,00",  # абсурдно большая
        "",
    ],
)
def test_amount_not_found(text):
    assert parse_amount(text) is None


DATE_CASES = [
    ("Дата: 12.10.2026", date(2026, 10, 12)),
    ("12.10.26 14:35", date(2026, 10, 12)),
    ("12/10/2026", date(2026, 10, 12)),
    ("2026-10-12T14:35", date(2026, 10, 12)),
    ("12 окт 2026", date(2026, 10, 12)),
    ("12 октября 2026 г.", date(2026, 10, 12)),
    ("Действителен до 01.05.2027\nЧЕК № 15 от 03.09.2026", date(2026, 9, 3)),  # будущая отброшена, есть «ЧЕК»
    ("Заказ 01.09.2026\nДоставка 05.09.2026", date(2026, 9, 5)),  # без ключевых слов — самая поздняя
    ("12.1O.2026", date(2026, 10, 12)),  # OCR: О вместо 0 в дате
]


@pytest.mark.parametrize("text,expected", DATE_CASES)
def test_date(text, expected):
    assert parse_date(text, TODAY) == expected


@pytest.mark.parametrize("text", ["01.01.2015", "31.02.2026", "15.12.2026", "Касса 3 смена 12"])
def test_date_rejected(text):
    assert parse_date(text, TODAY) is None  # слишком старая, несуществующая, в будущем, не дата


def test_full_receipt():
    text = "ООО «Вокзал»\nКАССОВЫЙ ЧЕК № 0042\nДата 12.10.2026 09:15\nБилет 3 450,00\nИТОГО =3 450,00\nСУММА НДС 0,00"
    data = parse_receipt(text, TODAY)
    assert data.amount == Decimal("3450.00") and data.expense_date == date(2026, 10, 12) and data.recognized


def test_garbage_is_not_recognized():
    data = parse_receipt("~~ ### ...\n|||| ,,,", TODAY)
    assert data.amount is None and data.expense_date is None and not data.recognized


def test_ocr_fix_only_inside_numbers():
    assert fix_ocr_digits("ООО Sole 1O5,OO") == "ООО Sole 105,00"
