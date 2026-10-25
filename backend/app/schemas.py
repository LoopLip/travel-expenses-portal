from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, ClassVar

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models import AdvanceStatus, ExpenseCategory, Role, TripStatus

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
]
Money = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]
NonNegMoney = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=2)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UpdateModel(BaseModel):
    """Базовый класс для частичного обновления (PATCH): поля можно опускать, но нельзя обнулять."""

    nullable_fields: ClassVar[set[str]] = set()

    @model_validator(mode="after")
    def _no_explicit_null(self):
        for field in self.model_fields_set - self.nullable_fields:
            if getattr(self, field) is None:
                raise ValueError(f"поле {field} нельзя установить в null")
        return self


# ---------- users ----------
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class UserRegister(BaseModel):
    """Саморегистрация. Роли в схеме нет намеренно: все новые пользователи получают роль employee."""

    full_name: Name
    email: Email
    password: Password
    department: Name | None = None


class UserUpdate(UpdateModel):
    full_name: Name | None = None
    email: Email | None = None
    department: Name | None = None

    nullable_fields: ClassVar[set[str]] = {"department"}


class UserOut(ORMModel):
    """Данные пользователя в ответах API. Поля password_hash здесь нет и быть не должно."""

    id: int
    full_name: str
    email: str
    department: str | None
    role: Role


class TokenResponse(BaseModel):
    """Ответ на вход и обновление. Refresh-токен передаётся только в HttpOnly-cookie."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int  # секунд до истечения access-токена


# ---------- budgets ----------
class BudgetCreate(BaseModel):
    department: Name
    period: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    limit_amount: Money


class BudgetUpdate(UpdateModel):
    department: Name | None = None
    period: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)] | None = None
    limit_amount: Money | None = None


class BudgetOut(ORMModel):
    id: int
    department: str
    period: str
    limit_amount: Decimal


class BudgetSummary(BudgetOut):
    reserved: Decimal  # сумма плановых сумм поездок (кроме черновиков и отклонённых)
    remaining: Decimal


# ---------- trips ----------
class TripBase(BaseModel):
    destination: Name
    purpose: str = Field(default="", max_length=2000)
    start_date: date
    end_date: date
    planned_amount: NonNegMoney = Decimal(0)


class TripCreate(TripBase):
    user_id: int | None = None  # не указан — командировка оформляется на текущего пользователя
    budget_id: int

    @model_validator(mode="after")
    def _check_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("дата окончания не может быть раньше даты начала")
        return self


class TripUpdate(UpdateModel):
    destination: Name | None = None
    purpose: Annotated[str, Field(max_length=2000)] | None = None
    start_date: date | None = None
    end_date: date | None = None
    planned_amount: NonNegMoney | None = None
    status: TripStatus | None = None
    budget_id: int | None = None


class TripOut(ORMModel):
    id: int
    destination: str
    purpose: str
    start_date: date
    end_date: date
    status: TripStatus
    planned_amount: Decimal
    user_id: int
    budget_id: int
    created_at: datetime


# ---------- advances ----------
class AdvanceCreate(BaseModel):
    trip_id: int
    amount: Money


class AdvanceUpdate(UpdateModel):
    amount: Money | None = None
    status: AdvanceStatus | None = None


class AdvanceOut(ORMModel):
    id: int
    trip_id: int
    amount: Decimal
    status: AdvanceStatus
    requested_at: date


# ---------- expenses ----------
class ExpenseCreate(BaseModel):
    trip_id: int
    category: ExpenseCategory
    description: Name
    amount: Money
    expense_date: date
    receipt_url: Annotated[str, StringConstraints(max_length=500)] | None = None


class ExpenseUpdate(UpdateModel):
    category: ExpenseCategory | None = None
    description: Name | None = None
    amount: Money | None = None
    expense_date: date | None = None
    receipt_url: Annotated[str, StringConstraints(max_length=500)] | None = None

    nullable_fields: ClassVar[set[str]] = {"receipt_url"}


class ExpenseOut(ORMModel):
    id: int
    trip_id: int
    category: ExpenseCategory
    description: str
    amount: Decimal
    expense_date: date
    receipt_url: str | None


class TripDetail(TripOut):
    advances: list[AdvanceOut]
    expenses: list[ExpenseOut]
