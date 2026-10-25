"""Права доступа по ролям и владению записями.

Правило ответов: если роль вообще не может выполнить операцию — 403 (ForbiddenError);
если сотрудник обращается к чужой записи — 404 (NotFoundError), чтобы не раскрывать, что она существует.
"""
from app import crud, models
from app.models import Role, TripStatus

STAFF = (Role.manager, Role.accountant)
EMPLOYEE_ALLOWED_STATUSES = (TripStatus.draft, TripStatus.pending)


def is_staff(user: models.User) -> bool:
    return user.role in STAFF


def require_role(user: models.User, *roles: Role) -> None:
    if user.role not in roles:
        raise crud.ForbiddenError("Недостаточно прав для этого действия")


def owner_filter(user: models.User) -> int | None:
    """id владельца, которым надо ограничить выборку: сотрудник видит только своё."""
    return None if is_staff(user) else user.id


def ensure_trip_visible(user: models.User, trip: models.Trip) -> None:
    if not is_staff(user) and trip.user_id != user.id:
        raise crud.NotFoundError(f"Командировка с id={trip.id} не найден(а)")


def ensure_advance_visible(user: models.User, advance: models.Advance) -> None:
    if not is_staff(user) and advance.trip.user_id != user.id:
        raise crud.NotFoundError(f"Аванс с id={advance.id} не найден(а)")


def ensure_expense_visible(user: models.User, expense: models.Expense) -> None:
    if not is_staff(user) and expense.trip.user_id != user.id:
        raise crud.NotFoundError(f"Расход с id={expense.id} не найден(а)")


def ensure_trip_status_allowed(user: models.User, status: TripStatus | None) -> None:
    """Сотрудник может только готовить заявку (draft) и отправлять её на согласование (pending)."""
    if status is not None and user.role == Role.employee and status not in EMPLOYEE_ALLOWED_STATUSES:
        raise crud.ForbiddenError("Сотрудник не может установить этот статус командировки")
