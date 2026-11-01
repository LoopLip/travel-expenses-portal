"""Разбор текста чека: сумма и дата. Чистые функции — без Tesseract и без файлов, принимают распознанный текст.

Правила простые и объяснимые: сначала ищем число рядом с ключевыми словами («ИТОГО», «К ОПЛАТЕ»…),
иначе берём наибольшую сумму с копейками. Человек всегда проверяет результат в форме.
"""
import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

MAX_AMOUNT = Decimal("10000000")  # больше 10 млн ₽ за один чек — почти наверняка ошибка распознавания
MAX_AGE_DAYS = 5 * 366  # чеки старше ~5 лет не принимаем

# Ключевые слова суммы в порядке надёжности: «ИТОГО» точнее, чем просто «СУММА».
AMOUNT_KEYWORDS = [("ИТОГ", 0), ("К ОПЛАТЕ", 0), ("TOTAL", 0), ("ВСЕГО", 1), ("СУММА", 2)]
# Строки с налогами, сдачей и округлением тоже содержат суммы, но это не итог чека.
AMOUNT_STOP_WORDS = ("НДС", "VAT", "СДАЧА", "ОКРУГЛ", "СКИДК")
DATE_KEYWORDS = ("ДАТА", "ЧЕК")

# Латинские буквы, похожие на кириллические: OCR часто путает их в ключевых словах («ИTОГO»).
_LOOKALIKES = str.maketrans("ABCEHKMOPTXY", "АВСЕНКМОРТХУ")

_MONTHS = {
    "янв": 1, "фев": 2, "мар": 3, "апр": 4, "мая": 5, "май": 5, "июн": 6,
    "июл": 7, "авг": 8, "сен": 9, "окт": 10, "ноя": 11, "дек": 12,
}

_DATE_PATTERNS = [
    re.compile(r"(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)"),  # ГГГГ-ММ-ДД
    re.compile(r"(?<!\d)(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)"),  # ДД.ММ.ГГГГ, ДД.ММ.ГГ, ДД/ММ/ГГГГ
    re.compile(r"(?<!\d)(\d{1,2})\s+(" + "|".join(_MONTHS) + r")[а-яё]*\.?\s+(\d{4})(?!\d)", re.IGNORECASE),
]

# Сумма с копейками: «1 234,50», «1234.50», «1234-50», «1234,5». Пробел — разделитель тысяч.
_MONEY = re.compile(r"(?<![\d.,])(\d{1,3}(?:[  ]\d{3})+|\d+)[.,\-](\d{1,2})(?![\d])")
# Целое число (только рядом с ключевым словом: «ИТОГО =1500»).
_INTEGER = re.compile(r"(?<![\d.,])(\d{1,3}(?:[  ]\d{3})+|\d+)(?![\d.,])")


@dataclass(frozen=True)
class ReceiptData:
    amount: Decimal | None
    expense_date: date | None

    @property
    def recognized(self) -> bool:
        return self.amount is not None or self.expense_date is not None


_OCR_DIGIT = str.maketrans({"O": "0", "o": "0", "О": "0", "о": "0", "l": "1", "I": "1", "|": "1", "S": "5", "Ѕ": "5"})
_NUMBER_LIKE = re.compile(r"(?<![A-Za-zА-Яа-яЁё])[\dOoОоlI|SЅ][\dOoОоlI|SЅ.,\-]*(?![A-Za-zА-Яа-яЁё])")


def fix_ocr_digits(text: str) -> str:
    """Типичные ошибки OCR внутри чисел: О→0, l/I/|→1, S→5.

    Меняем буквы только в «числоподобных» словах: в них есть цифра и либо разделитель копеек, либо цифр
    не меньше, чем букв («1O5,OO», «l25,50»). Обычные слова («ООО», «Sole») не трогаем.
    """

    def fix(m: re.Match) -> str:
        token = m.group(0)
        digits = sum(c.isdigit() for c in token)
        letters = sum(c.isalpha() or c == "|" for c in token)
        number_like = digits and (re.search(r"[.,]", token) or digits >= letters)
        return token.translate(_OCR_DIGIT) if number_like else token

    return _NUMBER_LIKE.sub(fix, text)


def _to_decimal(integer: str, fraction: str = "0") -> Decimal | None:
    try:
        value = Decimal(re.sub(r"[  ]", "", integer) + "." + fraction.ljust(2, "0"))
    except InvalidOperation:
        return None
    value = value.quantize(Decimal("0.01"))
    return value if Decimal(0) < value <= MAX_AMOUNT else None


def _strip_dates(line: str) -> str:
    """Убирает даты из строки, чтобы «12.10.2026» не приняли за сумму 12.10."""
    for pattern in _DATE_PATTERNS:
        line = pattern.sub(" ", line)
    return re.sub(r"\d{1,2}:\d{2}(:\d{2})?", " ", line)  # и время 14:35


def _money_in(line: str) -> list[Decimal]:
    return [v for m in _MONEY.finditer(_strip_dates(line)) if (v := _to_decimal(m.group(1), m.group(2))) is not None]


def _keyword_amount(line: str) -> list[Decimal]:
    clean = _strip_dates(line)
    found = _money_in(line)
    if not found:  # «ИТОГО =1500» без копеек
        found = [v for m in _INTEGER.finditer(clean) if (v := _to_decimal(m.group(1))) is not None]
    return found


def parse_amount(text: str) -> Decimal | None:
    lines = [fix_ocr_digits(l) for l in text.splitlines()]
    keys = [l.upper().translate(_LOOKALIKES) for l in lines]
    best: tuple[int, Decimal] | None = None
    for i, key in enumerate(keys):
        if any(stop in key for stop in AMOUNT_STOP_WORDS):
            continue
        rank = min((r for word, r in AMOUNT_KEYWORDS if word in key), default=None)
        if rank is None:
            continue
        values = _keyword_amount(lines[i])
        if not values and i + 1 < len(lines):  # сумма напечатана строкой ниже ключевого слова
            values = _keyword_amount(lines[i + 1])
        if values:
            candidate = (rank, max(values))
            if best is None or candidate[0] < best[0] or (candidate[0] == best[0] and candidate[1] > best[1]):
                best = candidate
    if best:
        return best[1]
    # Ключевых слов нет — наибольшая сумма с копейками, кроме строк с налогами и сдачей.
    values = [v for l, k in zip(lines, keys) if not any(s in k for s in AMOUNT_STOP_WORDS) for v in _money_in(l)]
    return max(values, default=None)


def _make_date(year: int, month: int, day: int) -> date | None:
    if year < 100:
        year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _dates_in(line: str) -> list[date]:
    found = []
    for pattern in _DATE_PATTERNS:
        for m in pattern.finditer(line):
            a, b, c = m.groups()
            if pattern is _DATE_PATTERNS[0]:
                d = _make_date(int(a), int(b), int(c))
            elif pattern is _DATE_PATTERNS[1]:
                d = _make_date(int(c), int(b), int(a))
            else:
                d = _make_date(int(c), _MONTHS[b.lower()[:3]], int(a))
            if d:
                found.append(d)
    return found


def parse_date(text: str, today: date | None = None) -> date | None:
    today = today or date.today()
    oldest = today - timedelta(days=MAX_AGE_DAYS)
    near_keyword, others = [], []
    for line in fix_ocr_digits(text).splitlines():
        valid = [d for d in _dates_in(line) if oldest <= d <= today]  # будущие и слишком старые отбрасываем
        key = line.upper().translate(_LOOKALIKES)
        (near_keyword if any(k in key for k in DATE_KEYWORDS) else others).extend(valid)
    if near_keyword:
        return near_keyword[0]
    return max(others, default=None)


def parse_receipt(text: str, today: date | None = None) -> ReceiptData:
    return ReceiptData(amount=parse_amount(text), expense_date=parse_date(text, today))
