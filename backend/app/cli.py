"""Служебные команды.

Создать пользователя с ролью (роли manager и accountant назначить через API нельзя, только так или в БД):

    $env:NEW_USER_PASSWORD = "<пароль, не короче 8 символов>"
    python -m app.cli create-user --email manager@example.com --full-name "Руководитель" --role manager

Заполнить базу демонстрационными данными (руководитель, бухгалтер, два сотрудника, бюджеты, командировки
с авансами и расходами). Один пароль для всех демо-пользователей; в коде он не хранится:

    $env:DEMO_PASSWORD = "<пароль, не короче 8 символов>"
    python -m app.cli seed-demo

Если переменная не задана, пароль запрашивается при запуске (ввод не отображается). Повторный запуск безопасен:
существующие пользователи, бюджеты и командировки не дублируются и не изменяются (пароли тоже).
"""
import argparse
import getpass
import os
import sys
from datetime import date
from decimal import Decimal

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import crud, models, schemas, security
from app.db import Base, SessionLocal, engine
from app.models import AdvanceStatus, ExpenseCategory, Role, TripStatus


def _validation_text(exc: ValidationError) -> str:
    return "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors())


def create_user(args: argparse.Namespace) -> int:
    password = os.environ.get("NEW_USER_PASSWORD") or getpass.getpass("Пароль: ")
    try:
        data = schemas.UserRegister(full_name=args.full_name, email=args.email, password=password, department=args.department)
    except ValidationError as exc:
        print("Некорректные данные:", _validation_text(exc), file=sys.stderr)
        return 2
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        try:
            user = crud.create_user(db, data, security.hash_password(password), models.Role(args.role))
        except crud.ConflictError as exc:
            print(exc, file=sys.stderr)
            return 1
    print(f"Создан пользователь id={user.id}, {user.email}, роль {user.role.value}")
    return 0


# ---------- демо-данные ----------
# Вымышленные люди и адреса на домене example.com (зарезервирован для примеров).
DEMO_USERS = [
    ("manager@example.com", "Смирнова Ольга", "Руководство", Role.manager),
    ("accountant@example.com", "Кузнецов Дмитрий", "Бухгалтерия", Role.accountant),
    ("ivanov@example.com", "Иванов Иван", "Продажи", Role.employee),
    ("petrova@example.com", "Петрова Анна", "Разработка", Role.employee),
]
DEMO_BUDGETS = [
    ("Продажи", "2026-Q4", "600000.00"),
    ("Разработка", "2026-Q4", "350000.00"),
    ("Маркетинг", "2026-Q4", "200000.00"),
]
# (сотрудник, бюджет, направление, цель, начало, конец, план, статус, авансы [(сумма, статус)], расходы [(категория, описание, сумма, дата)])
DEMO_TRIPS = [
    ("ivanov@example.com", "Продажи", "Санкт-Петербург", "Встреча с клиентом", date(2026, 10, 12), date(2026, 10, 15),
     "85000.00", TripStatus.completed, [("40000.00", AdvanceStatus.settled)],
     [(ExpenseCategory.transport, "Сапсан Москва — Санкт-Петербург", "7400.00", date(2026, 10, 12)),
      (ExpenseCategory.lodging, "Гостиница, 3 ночи", "21600.00", date(2026, 10, 15))]),
    ("ivanov@example.com", "Продажи", "Екатеринбург", "Выставка «Иннопром»", date(2026, 12, 7), date(2026, 12, 10),
     "64000.00", TripStatus.pending, [("20000.00", AdvanceStatus.requested)], []),
    ("ivanov@example.com", "Маркетинг", "Сочи", "Корпоративное обучение", date(2027, 1, 20), date(2027, 1, 23),
     "95000.00", TripStatus.draft, [], []),
    ("petrova@example.com", "Разработка", "Казань", "Конференция разработчиков", date(2026, 11, 3), date(2026, 11, 6),
     "72000.00", TripStatus.approved, [("30000.00", AdvanceStatus.issued)],
     [(ExpenseCategory.transport, "Авиабилеты", "12800.00", date(2026, 11, 3)),
      (ExpenseCategory.meals, "Ужин с докладчиками", "3450.00", date(2026, 11, 4))]),
    ("petrova@example.com", "Разработка", "Новосибирск", "Открытие филиала", date(2026, 12, 14), date(2026, 12, 18),
     "140000.00", TripStatus.rejected, [], []),
]


def seed_demo(db: Session, password: str) -> dict[str, int]:
    """Создаёт недостающие демо-записи и возвращает, сколько записей каждого вида добавлено."""
    added = {"users": 0, "budgets": 0, "trips": 0, "advances": 0, "expenses": 0}
    users: dict[str, models.User] = {}
    password_hash: str | None = None
    for email, name, department, role in DEMO_USERS:
        user = db.scalar(select(models.User).where(models.User.email == email))
        if user is None:
            password_hash = password_hash or security.hash_password(password)  # argon2 медленный: один хеш на всех
            user = models.User(full_name=name, email=email, department=department, password_hash=password_hash, role=role)
            db.add(user)
            added["users"] += 1
        users[email] = user

    budgets: dict[str, models.Budget] = {}
    for department, period, limit in DEMO_BUDGETS:
        budget = db.scalar(select(models.Budget).where(models.Budget.department == department, models.Budget.period == period))
        if budget is None:
            budget = models.Budget(department=department, period=period, limit_amount=Decimal(limit))
            db.add(budget)
            added["budgets"] += 1
        budgets[department] = budget
    db.flush()  # нужны id пользователей и бюджетов

    for email, budget_name, destination, purpose, start, end, planned, status, advances, expenses in DEMO_TRIPS:
        user = users[email]
        exists = db.scalar(
            select(models.Trip.id).where(models.Trip.user_id == user.id, models.Trip.destination == destination, models.Trip.start_date == start)
        )
        if exists is not None:
            continue  # командировка уже есть — её авансы и расходы не трогаем
        trip = models.Trip(
            destination=destination, purpose=purpose, start_date=start, end_date=end, planned_amount=Decimal(planned),
            status=status, user_id=user.id, budget_id=budgets[budget_name].id,
        )
        trip.advances = [models.Advance(amount=Decimal(amount), status=adv_status) for amount, adv_status in advances]
        trip.expenses = [
            models.Expense(category=category, description=text, amount=Decimal(amount), expense_date=day)
            for category, text, amount, day in expenses
        ]
        db.add(trip)
        added["trips"] += 1
        added["advances"] += len(advances)
        added["expenses"] += len(expenses)
    db.commit()
    return added


def seed_demo_command(_: argparse.Namespace) -> int:
    password = os.environ.get("DEMO_PASSWORD") or getpass.getpass("Пароль для демо-пользователей: ")
    if not 8 <= len(password) <= 128:
        print("Пароль должен быть от 8 до 128 символов", file=sys.stderr)
        return 2
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        added = seed_demo(db, password)
    print("Добавлено: " + ", ".join(f"{k} — {v}" for k, v in added.items()))
    print("Пользователи: " + ", ".join(f"{email} ({role.value})" for email, _, _, role in DEMO_USERS))
    if added["users"] < len(DEMO_USERS):
        print("Уже существовавшие пользователи сохранили прежний пароль.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-user", help="создать пользователя с указанной ролью")
    p.add_argument("--email", required=True)
    p.add_argument("--full-name", required=True)
    p.add_argument("--role", choices=[r.value for r in models.Role], default="employee")
    p.add_argument("--department")
    p.set_defaults(func=create_user)
    s = sub.add_parser("seed-demo", help="заполнить БД демонстрационными данными (повторный запуск безопасен)")
    s.set_defaults(func=seed_demo_command)
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
