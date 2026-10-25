"""Тесты работают с настоящим PostgreSQL, но в отдельной БД `<имя>_test` (создаётся автоматически)."""
import os

# Секрет для тестов задаём до импорта приложения (настройки читаются при импорте).
os.environ.setdefault("JWT_SECRET", "test-only-secret-" + "x" * 40)

import pytest  # noqa: E402
from argon2 import PasswordHasher  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app import models, security  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

# Быстрые параметры argon2 только для тестов (в приложении — параметры библиотеки по умолчанию).
security.hasher = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)

PASSWORD = "correct-horse-battery"


def _prepare_test_database() -> str:
    url = make_url(settings.database_url)
    test_name = f"{url.database}_test"
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": test_name})
        if not exists:
            conn.execute(text(f'CREATE DATABASE "{test_name}"'))
    admin.dispose()
    return url.set(database=test_name).render_as_string(hide_password=False)


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(_prepare_test_database())
    yield eng
    eng.dispose()


@pytest.fixture()
def Session(engine):
    """Чистые таблицы перед каждым тестом; приложение работает с тестовой БД."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with factory() as s:
            yield s

    app.dependency_overrides[get_db] = override_get_db
    yield factory
    app.dependency_overrides.clear()


@pytest.fixture()
def anon(Session):
    """Клиент без входа (со своим хранилищем cookie)."""
    return TestClient(app)


# ---------- пользователи и вход ----------
@pytest.fixture()
def create_user(Session):
    """Создаёт пользователя прямо в БД (так появляются менеджеры и бухгалтеры: через API роль не назначить)."""
    counter = {"n": 0}

    def _create(role: str = "employee", email: str | None = None, name: str | None = None, password: str = PASSWORD):
        counter["n"] += 1
        email = email or f"{role}{counter['n']}@example.com"
        with Session() as s:
            user = models.User(
                full_name=name or f"Тест {role} {counter['n']}",
                email=email,
                department="Продажи",
                password_hash=security.hash_password(password),
                role=models.Role(role),
            )
            s.add(user)
            s.commit()
            return {"id": user.id, "email": email, "password": password, "role": role, "full_name": user.full_name}

    return _create


@pytest.fixture()
def login(anon):
    def _login(user: dict, client: TestClient | None = None) -> str:
        c = client or anon
        r = c.post("/auth/login", data={"username": user["email"], "password": user["password"]})
        assert r.status_code == 200, r.text
        return r.json()["access_token"]

    return _login


@pytest.fixture()
def client_for(Session, login):
    """Клиент, вошедший под указанным пользователем (заголовок Authorization подставлен)."""

    def _client(user: dict) -> TestClient:
        c = TestClient(app)
        c.headers["Authorization"] = f"Bearer {login(user, c)}"
        return c

    return _client


@pytest.fixture()
def manager(create_user):
    return create_user("manager", "manager@example.com", "Руководитель")


@pytest.fixture()
def accountant(create_user):
    return create_user("accountant", "accountant@example.com", "Бухгалтер")


@pytest.fixture()
def employee(create_user):
    return create_user("employee", "employee@example.com", "Сотрудник")


@pytest.fixture()
def client(manager, client_for):
    """Основной клиент прежних тестов (CRUD): вошёл руководитель, у него есть права на всё."""
    return client_for(manager)


# ---------- фабрики тестовых данных (создаёт руководитель) ----------
@pytest.fixture()
def make_user(create_user):
    counter = {"n": 0}

    def _make(email=None, name="Иванов Иван"):
        counter["n"] += 1
        return create_user("employee", email or f"ivanov{counter['n']}@example.com", name)

    return _make


@pytest.fixture()
def make_budget(client):
    def _make(limit="500000.00"):
        r = client.post("/budgets", json={"department": "Продажи", "period": "2026, Q4", "limit_amount": limit})
        assert r.status_code == 201, r.text
        return r.json()

    return _make


@pytest.fixture()
def make_trip(client, make_user, make_budget):
    def _make(planned="100000.00", **overrides):
        user = overrides.pop("user", None) or make_user()
        budget = overrides.pop("budget", None) or make_budget()
        by = overrides.pop("by", None) or client
        payload = {
            "destination": "Казань",
            "purpose": "Конференция",
            "start_date": "2026-11-03",
            "end_date": "2026-11-06",
            "planned_amount": planned,
            "user_id": user["id"],
            "budget_id": budget["id"],
            **overrides,
        }
        r = by.post("/trips", json=payload)
        assert r.status_code == 201, r.text
        return r.json()

    return _make
