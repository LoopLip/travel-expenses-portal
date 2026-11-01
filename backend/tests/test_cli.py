"""Команда seed-demo: демо-данные создаются один раз, повторный запуск ничего не дублирует."""
from sqlalchemy import func, select

from app import cli, models, security

DEMO_PASSWORD = "demo-password-for-tests"


def _counts(db):
    return {m.__tablename__: db.scalar(select(func.count()).select_from(m)) for m in (models.User, models.Budget, models.Trip, models.Advance, models.Expense)}


def test_seed_demo_creates_roles_and_related_data(Session):
    with Session() as db:
        added = cli.seed_demo(db, DEMO_PASSWORD)
        assert added == {"users": 4, "budgets": 3, "trips": 5, "advances": 3, "expenses": 4}
        roles = {u.email: u.role for u in db.scalars(select(models.User))}
        assert roles["manager@example.com"] == models.Role.manager
        assert roles["accountant@example.com"] == models.Role.accountant
        assert roles["ivanov@example.com"] == models.Role.employee
        user = db.scalar(select(models.User).where(models.User.email == "petrova@example.com"))
        assert user.password_hash != DEMO_PASSWORD and security.verify_password(DEMO_PASSWORD, user.password_hash)


def test_seed_demo_is_idempotent(Session):
    with Session() as db:
        cli.seed_demo(db, DEMO_PASSWORD)
        before = _counts(db)
        again = cli.seed_demo(db, "another-password")
        assert again == {"users": 0, "budgets": 0, "trips": 0, "advances": 0, "expenses": 0}
        assert _counts(db) == before
        manager = db.scalar(select(models.User).where(models.User.email == "manager@example.com"))
        assert security.verify_password(DEMO_PASSWORD, manager.password_hash)  # пароль существующего не меняется


def test_seed_demo_respects_existing_user(Session, create_user):
    create_user("employee", "ivanov@example.com", "Иванов Иван")
    with Session() as db:
        added = cli.seed_demo(db, DEMO_PASSWORD)
    assert added["users"] == 3


def test_demo_data_visible_through_api_by_role(Session, client_for):
    with Session() as db:
        cli.seed_demo(db, DEMO_PASSWORD)
    employee = client_for({"email": "ivanov@example.com", "password": DEMO_PASSWORD})
    manager = client_for({"email": "manager@example.com", "password": DEMO_PASSWORD})
    assert len(employee.get("/trips").json()) == 3  # только свои
    assert len(manager.get("/trips").json()) == 5
    summary = manager.get("/budgets").json()
    assert {b["department"] for b in summary} == {"Продажи", "Разработка", "Маркетинг"}
