"""Операции с данными и бизнес-логика. Ошибки — доменные исключения, HTTP-коды назначает main.py."""
from decimal import Decimal
from typing import Any, TypeVar

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas


class NotFoundError(Exception):
    """Запись не найдена -> 404."""


class ConflictError(Exception):
    """Нарушение уникальности или ссылочной целостности -> 409."""


class BusinessRuleError(Exception):
    """Нарушение бизнес-правила -> 400."""


class AuthenticationError(Exception):
    """Не удалось подтвердить личность (нет/неверный/истёкший токен, неверный пароль) -> 401."""


class ForbiddenError(Exception):
    """Личность известна, но прав на операцию нет -> 403."""


T = TypeVar("T")


def _get_or_404(db: Session, model: type[T], obj_id: int, label: str) -> T:
    obj = db.get(model, obj_id)
    if obj is None:
        raise NotFoundError(f"{label} с id={obj_id} не найден(а)")
    return obj


def _commit(db: Session, conflict_message: str) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictError(conflict_message) from exc


def _apply(obj: Any, data: dict[str, Any]) -> None:
    for key, value in data.items():
        setattr(obj, key, value)


# ---------- users ----------
def list_users(db: Session, skip: int, limit: int) -> list[models.User]:
    return list(db.scalars(select(models.User).order_by(models.User.id).offset(skip).limit(limit)))


def get_user(db: Session, user_id: int) -> models.User:
    return _get_or_404(db, models.User, user_id, "Пользователь")


def _ensure_email_free(db: Session, email: str, exclude_id: int | None = None) -> None:
    stmt = select(models.User.id).where(models.User.email == email)
    existing = db.scalar(stmt)
    if existing is not None and existing != exclude_id:
        raise ConflictError(f"Пользователь с email {email} уже существует")


def create_user(
    db: Session, data: schemas.UserRegister, password_hash: str, role: models.Role = models.Role.employee
) -> models.User:
    _ensure_email_free(db, data.email)
    user = models.User(
        full_name=data.full_name,
        email=data.email,
        department=data.department,
        password_hash=password_hash,
        role=role,
    )
    db.add(user)
    _commit(db, f"Пользователь с email {data.email} уже существует")
    db.refresh(user)
    return user


def update_user(db: Session, user_id: int, data: schemas.UserUpdate) -> models.User:
    user = get_user(db, user_id)
    changes = data.model_dump(exclude_unset=True)
    if "email" in changes:
        _ensure_email_free(db, changes["email"], exclude_id=user_id)
    _apply(user, changes)
    _commit(db, "Пользователь с таким email уже существует")
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    user = get_user(db, user_id)
    if db.scalar(select(func.count()).select_from(models.Trip).where(models.Trip.user_id == user_id)):
        raise ConflictError("Нельзя удалить пользователя: у него есть командировки")
    db.delete(user)
    _commit(db, "Нельзя удалить пользователя: есть связанные записи")


# ---------- budgets ----------
def list_budgets(db: Session, skip: int, limit: int) -> list[models.Budget]:
    return list(db.scalars(select(models.Budget).order_by(models.Budget.id).offset(skip).limit(limit)))


def get_budget(db: Session, budget_id: int) -> models.Budget:
    return _get_or_404(db, models.Budget, budget_id, "Бюджет")


def create_budget(db: Session, data: schemas.BudgetCreate) -> models.Budget:
    budget = models.Budget(**data.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


def update_budget(db: Session, budget_id: int, data: schemas.BudgetUpdate) -> models.Budget:
    budget = get_budget(db, budget_id)
    _apply(budget, data.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(budget)
    return budget


def delete_budget(db: Session, budget_id: int) -> None:
    budget = get_budget(db, budget_id)
    if db.scalar(select(func.count()).select_from(models.Trip).where(models.Trip.budget_id == budget_id)):
        raise ConflictError("Нельзя удалить бюджет: к нему привязаны командировки")
    db.delete(budget)
    _commit(db, "Нельзя удалить бюджет: есть связанные записи")


def budget_summary(db: Session, budget_id: int) -> schemas.BudgetSummary:
    budget = get_budget(db, budget_id)
    reserved = db.scalar(
        select(func.coalesce(func.sum(models.Trip.planned_amount), 0)).where(
            models.Trip.budget_id == budget_id,
            models.Trip.status.not_in([models.TripStatus.draft, models.TripStatus.rejected]),
        )
    )
    reserved = Decimal(reserved)
    return schemas.BudgetSummary(
        **schemas.BudgetOut.model_validate(budget).model_dump(),
        reserved=reserved,
        remaining=budget.limit_amount - reserved,
    )


# ---------- trips ----------
def list_trips(
    db: Session,
    skip: int,
    limit: int,
    status: models.TripStatus | None = None,
    user_id: int | None = None,
    budget_id: int | None = None,
) -> list[models.Trip]:
    stmt = select(models.Trip).order_by(models.Trip.id).offset(skip).limit(limit)
    if status is not None:
        stmt = stmt.where(models.Trip.status == status)
    if user_id is not None:
        stmt = stmt.where(models.Trip.user_id == user_id)
    if budget_id is not None:
        stmt = stmt.where(models.Trip.budget_id == budget_id)
    return list(db.scalars(stmt))


def get_trip(db: Session, trip_id: int) -> models.Trip:
    return _get_or_404(db, models.Trip, trip_id, "Командировка")


def create_trip(db: Session, data: schemas.TripCreate, user_id: int) -> models.Trip:
    get_user(db, user_id)
    get_budget(db, data.budget_id)
    trip = models.Trip(**{**data.model_dump(), "user_id": user_id})
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def update_trip(db: Session, trip_id: int, data: schemas.TripUpdate) -> models.Trip:
    trip = get_trip(db, trip_id)
    changes = data.model_dump(exclude_unset=True)
    start = changes.get("start_date", trip.start_date)
    end = changes.get("end_date", trip.end_date)
    if end < start:
        raise BusinessRuleError("Дата окончания не может быть раньше даты начала")
    if "budget_id" in changes:
        get_budget(db, changes["budget_id"])
    new_planned = changes.get("planned_amount", trip.planned_amount)
    issued = sum((a.amount for a in trip.advances), Decimal(0))
    if issued > new_planned:
        raise BusinessRuleError("Плановая сумма не может быть меньше суммы авансов по командировке")
    _apply(trip, changes)
    db.commit()
    db.refresh(trip)
    return trip


def delete_trip(db: Session, trip_id: int) -> None:
    trip = get_trip(db, trip_id)
    db.delete(trip)  # авансы и расходы удаляются каскадом
    db.commit()


# ---------- advances ----------
def list_advances(
    db: Session, skip: int, limit: int, trip_id: int | None = None, owner_id: int | None = None
) -> list[models.Advance]:
    stmt = select(models.Advance).order_by(models.Advance.id).offset(skip).limit(limit)
    if trip_id is not None:
        stmt = stmt.where(models.Advance.trip_id == trip_id)
    if owner_id is not None:  # только авансы по командировкам этого сотрудника
        stmt = stmt.join(models.Trip, models.Trip.id == models.Advance.trip_id).where(models.Trip.user_id == owner_id)
    return list(db.scalars(stmt))


def get_advance(db: Session, advance_id: int) -> models.Advance:
    return _get_or_404(db, models.Advance, advance_id, "Аванс")


def _check_advance_limit(trip: models.Trip, new_amount: Decimal, exclude_id: int | None = None) -> None:
    others = sum((a.amount for a in trip.advances if a.id != exclude_id), Decimal(0))
    if others + new_amount > trip.planned_amount:
        raise BusinessRuleError(
            f"Сумма авансов ({others + new_amount}) превышает плановую сумму командировки ({trip.planned_amount})"
        )


def create_advance(db: Session, data: schemas.AdvanceCreate) -> models.Advance:
    trip = get_trip(db, data.trip_id)
    _check_advance_limit(trip, data.amount)
    advance = models.Advance(**data.model_dump())
    db.add(advance)
    db.commit()
    db.refresh(advance)
    return advance


def update_advance(db: Session, advance_id: int, data: schemas.AdvanceUpdate) -> models.Advance:
    advance = get_advance(db, advance_id)
    changes = data.model_dump(exclude_unset=True)
    if "amount" in changes:
        _check_advance_limit(advance.trip, changes["amount"], exclude_id=advance_id)
    _apply(advance, changes)
    db.commit()
    db.refresh(advance)
    return advance


def delete_advance(db: Session, advance_id: int) -> None:
    db.delete(get_advance(db, advance_id))
    db.commit()


# ---------- expenses ----------
def list_expenses(
    db: Session, skip: int, limit: int, trip_id: int | None = None, owner_id: int | None = None
) -> list[models.Expense]:
    stmt = select(models.Expense).order_by(models.Expense.id).offset(skip).limit(limit)
    if trip_id is not None:
        stmt = stmt.where(models.Expense.trip_id == trip_id)
    if owner_id is not None:
        stmt = stmt.join(models.Trip, models.Trip.id == models.Expense.trip_id).where(models.Trip.user_id == owner_id)
    return list(db.scalars(stmt))


def get_expense(db: Session, expense_id: int) -> models.Expense:
    return _get_or_404(db, models.Expense, expense_id, "Расход")


def create_expense(db: Session, data: schemas.ExpenseCreate) -> models.Expense:
    get_trip(db, data.trip_id)
    expense = models.Expense(**data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense_id: int, data: schemas.ExpenseUpdate) -> models.Expense:
    expense = get_expense(db, expense_id)
    _apply(expense, data.model_dump(exclude_unset=True))
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense_id: int) -> None:
    db.delete(get_expense(db, expense_id))
    db.commit()
