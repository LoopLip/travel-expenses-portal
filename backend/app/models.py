import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Enum, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class TripStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    completed = "completed"


class AdvanceStatus(str, enum.Enum):
    requested = "requested"
    issued = "issued"
    settled = "settled"


class ExpenseCategory(str, enum.Enum):
    transport = "transport"
    lodging = "lodging"
    meals = "meals"
    other = "other"


class Role(str, enum.Enum):
    employee = "employee"  # сотрудник: работает со своими данными
    manager = "manager"  # руководитель: видит всё, согласует командировки
    accountant = "accountant"  # бухгалтер: видит всё, выдаёт авансы, ведёт бюджеты


def _enum(e: type[enum.Enum]) -> Enum:
    # Строковый столбец + CHECK вместо нативного ENUM: проще менять набор значений.
    return Enum(e, native_enum=False, length=20, values_callable=lambda x: [m.value for m in x])


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    department: Mapped[str | None] = mapped_column(String(120))
    # Хеш пароля (argon2id). Сам пароль нигде не хранится и не возвращается API.
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role), default=Role.employee)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    trips: Mapped[list["Trip"]] = relationship(back_populates="employee")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (CheckConstraint("limit_amount > 0", name="ck_budgets_limit_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    department: Mapped[str] = mapped_column(String(120))
    period: Mapped[str] = mapped_column(String(40))
    limit_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    trips: Mapped[list["Trip"]] = relationship(back_populates="budget")


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("end_date >= start_date", name="ck_trips_dates"),
        CheckConstraint("planned_amount >= 0", name="ck_trips_planned_nonneg"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    destination: Mapped[str] = mapped_column(String(120))
    purpose: Mapped[str] = mapped_column(Text, default="")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    status: Mapped[TripStatus] = mapped_column(_enum(TripStatus), default=TripStatus.draft)
    planned_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal(0))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Сотрудника и бюджет с командировками нельзя удалить (RESTRICT), пока поездки существуют.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    budget_id: Mapped[int] = mapped_column(ForeignKey("budgets.id", ondelete="RESTRICT"))

    employee: Mapped[User] = relationship(back_populates="trips")
    budget: Mapped[Budget] = relationship(back_populates="trips")
    # Авансы и расходы принадлежат командировке и удаляются вместе с ней.
    advances: Mapped[list["Advance"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", passive_deletes=True
    )
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan", passive_deletes=True
    )


class Advance(Base):
    __tablename__ = "advances"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_advances_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[AdvanceStatus] = mapped_column(_enum(AdvanceStatus), default=AdvanceStatus.requested)
    requested_at: Mapped[date] = mapped_column(Date, server_default=func.current_date())

    trip: Mapped[Trip] = relationship(back_populates="advances")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_expenses_amount_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id", ondelete="CASCADE"), index=True)
    category: Mapped[ExpenseCategory] = mapped_column(_enum(ExpenseCategory))
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    expense_date: Mapped[date] = mapped_column(Date)
    receipt_url: Mapped[str | None] = mapped_column(String(500))

    trip: Mapped[Trip] = relationship(back_populates="expenses")

class RefreshToken(Base):
    """Сессия входа: одна запись на каждый выданный refresh-токен (при обновлении выдаётся новый)."""

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    jti: Mapped[str] = mapped_column(String(36), unique=True)  # идентификатор токена (claim jti)
    family_id: Mapped[str] = mapped_column(String(36), index=True)  # все токены одной сессии входа
    token_hash: Mapped[str] = mapped_column(String(64))  # SHA-256 от токена; сам токен не хранится
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    user_agent: Mapped[str | None] = mapped_column(String(255))

    user: Mapped[User] = relationship(back_populates="refresh_tokens")
