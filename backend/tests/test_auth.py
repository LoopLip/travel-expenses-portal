"""Аутентификация: регистрация, вход, JWT, refresh-токены с ротацией, выход."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import select

from app import models, security
from app.config import JWT_ALGORITHM, REFRESH_COOKIE_NAME, settings
from tests.conftest import PASSWORD

NEW_USER = {"full_name": "  Петрова Анна ", "email": "Anna@Example.com", "password": PASSWORD, "department": "Разработка"}


def refresh_cookie(c):
    return c.cookies.get(REFRESH_COOKIE_NAME, path="/auth")


def rows(Session):
    with Session() as s:
        return list(s.scalars(select(models.RefreshToken).order_by(models.RefreshToken.id)))


# ---------- регистрация ----------
def test_register_creates_employee_without_leaking_password(anon):
    r = anon.post("/auth/register", json=NEW_USER)
    assert r.status_code == 201
    body = r.json()
    assert body["full_name"] == "Петрова Анна" and body["email"] == "anna@example.com"
    assert body["role"] == "employee"
    assert "password" not in body and "password_hash" not in body


def test_register_cannot_choose_role(anon):
    r = anon.post("/auth/register", json={**NEW_USER, "role": "manager"})
    assert r.status_code == 201 and r.json()["role"] == "employee"


def test_register_duplicate_email_is_409_case_insensitive(anon):
    assert anon.post("/auth/register", json=NEW_USER).status_code == 201
    r = anon.post("/auth/register", json={**NEW_USER, "email": "ANNA@example.com"})
    assert r.status_code == 409 and "уже существует" in r.json()["detail"]


@pytest.mark.parametrize(
    "patch",
    [
        {"password": "short7!"},  # 7 символов
        {"password": "x" * 129},
        {"email": "not-an-email"},
        {"full_name": ""},
        {"password": None},
    ],
)
def test_register_validation_422(anon, patch):
    assert anon.post("/auth/register", json={**NEW_USER, **patch}).status_code == 422


def test_register_missing_fields_422(anon):
    assert anon.post("/auth/register", json={"email": "x@example.com"}).status_code == 422


def test_password_is_stored_as_salted_argon2_hash(anon, Session):
    anon.post("/auth/register", json=NEW_USER)
    anon.post("/auth/register", json={**NEW_USER, "email": "second@example.com"})
    with Session() as s:
        hashes = [u.password_hash for u in s.scalars(select(models.User))]
    assert len(hashes) == 2
    assert all(h.startswith("$argon2id$") for h in hashes)
    assert PASSWORD not in "".join(hashes)
    assert hashes[0] != hashes[1]  # одинаковые пароли дают разные хеши (случайная соль)


# ---------- вход ----------
def test_login_returns_access_token_and_httponly_refresh_cookie(anon, employee):
    r = anon.post("/auth/login", data={"username": employee["email"], "password": PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer" and body["expires_in"] == int(settings.access_token_expire_minutes * 60)
    assert "refresh" not in r.text.lower().replace("refresh_token=", "")  # refresh-токена в теле нет
    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{REFRESH_COOKIE_NAME}=")
    assert "HttpOnly" in cookie and "Path=/auth" in cookie and "SameSite=lax" in cookie
    assert r.headers["cache-control"] == "no-store"


def test_login_is_case_insensitive_for_email(anon, employee):
    r = anon.post("/auth/login", data={"username": employee["email"].upper(), "password": PASSWORD})
    assert r.status_code == 200


def test_wrong_password_and_unknown_email_give_identical_401(anon, employee):
    wrong = anon.post("/auth/login", data={"username": employee["email"], "password": "wrong-password"})
    unknown = anon.post("/auth/login", data={"username": "nobody@example.com", "password": PASSWORD})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Неверный email или пароль"}
    assert wrong.headers["www-authenticate"] == "Bearer"
    assert REFRESH_COOKIE_NAME not in wrong.headers.get("set-cookie", "")


def test_disabled_user_cannot_login(anon, employee, Session):
    with Session() as s:
        s.get(models.User, employee["id"]).is_active = False
        s.commit()
    assert anon.post("/auth/login", data={"username": employee["email"], "password": PASSWORD}).status_code == 401


def test_me_returns_current_user(client_for, employee):
    r = client_for(employee).get("/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == employee["email"] and r.json()["role"] == "employee"
    assert "password_hash" not in r.json()


# ---------- JWT ----------
def test_access_token_claims(login, employee):
    token = login(employee)
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[JWT_ALGORITHM])
    assert set(payload) == {"sub", "type", "iat", "exp", "jti"}
    assert payload["type"] == "access" and payload["sub"] == str(employee["id"])
    assert payload["exp"] - payload["iat"] == int(settings.access_token_expire_minutes * 60)


@pytest.mark.parametrize("path", ["/auth/me", "/users", "/budgets", "/trips", "/advances", "/expenses", "/trips/1", "/budgets/1/summary"])
def test_private_endpoints_require_token(anon, path):
    r = anon.get(path)
    assert r.status_code == 401
    assert r.json() == {"detail": "Требуется авторизация"}
    assert r.headers["www-authenticate"] == "Bearer"


def test_public_endpoints_need_no_token(anon):
    assert anon.get("/health").status_code == 200
    assert anon.get("/docs").status_code == 200
    assert anon.get("/openapi.json").status_code == 200


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_malformed_token_is_401(anon):
    r = anon.get("/auth/me", headers=bearer("not.a.jwt"))
    assert r.status_code == 401 and r.json()["detail"] == "Недействительный токен"


def test_token_with_wrong_signature_is_401(anon, employee):
    forged = jwt.encode(
        {"sub": str(employee["id"]), "type": "access", "iat": 1, "exp": 9999999999, "jti": "x"}, "another-secret-" + "y" * 32, algorithm=JWT_ALGORITHM
    )
    assert anon.get("/auth/me", headers=bearer(forged)).status_code == 401


def test_token_with_alg_none_is_401(anon, employee):
    unsigned = jwt.encode({"sub": str(employee["id"]), "type": "access", "iat": 1, "exp": 9999999999, "jti": "x"}, None, algorithm="none")
    assert anon.get("/auth/me", headers=bearer(unsigned)).status_code == 401


def test_modified_payload_breaks_signature(anon, login, employee, manager):
    token = login(employee)
    header, _, signature = token.split(".")
    other = jwt.encode({"sub": str(manager["id"]), "type": "access", "iat": 1, "exp": 9999999999, "jti": "x"}, "k" * 40, algorithm=JWT_ALGORITHM)
    forged = f"{header}.{other.split('.')[1]}.{signature}"  # чужое содержимое со старой подписью
    assert anon.get("/auth/me", headers=bearer(forged)).status_code == 401


def test_expired_access_token_is_401(anon, employee):
    expired = security.create_access_token(employee["id"], expires_delta=timedelta(seconds=-5))
    r = anon.get("/auth/me", headers=bearer(expired))
    assert r.status_code == 401 and r.json()["detail"] == "Срок действия токена истёк"


def test_refresh_token_is_not_accepted_as_access(anon, employee):
    token, _, _ = security.create_refresh_token(employee["id"])
    assert anon.get("/auth/me", headers=bearer(token)).status_code == 401


def test_access_token_is_not_accepted_as_refresh(anon, login, employee):
    access = login(employee)
    anon.cookies.set(REFRESH_COOKIE_NAME, access, path="/auth")
    assert anon.post("/auth/refresh").status_code == 401


def test_token_of_deleted_user_is_401(client_for, employee, Session):
    c = client_for(employee)
    with Session() as s:
        s.delete(s.get(models.User, employee["id"]))
        s.commit()
    assert c.get("/auth/me").status_code == 401


# ---------- refresh и ротация ----------
def test_refresh_issues_new_access_and_rotates_refresh(anon, employee, login, Session):
    login(employee)
    old = refresh_cookie(anon)
    r = anon.post("/auth/refresh")
    assert r.status_code == 200 and r.json()["token_type"] == "bearer"
    new = refresh_cookie(anon)
    assert new and new != old
    assert anon.get("/auth/me", headers=bearer(r.json()["access_token"])).status_code == 200
    first, second = rows(Session)
    assert first.revoked_at is not None and second.revoked_at is None
    assert first.family_id == second.family_id  # одна сессия
    assert second.token_hash != new and len(second.token_hash) == 64  # в БД только хеш, не сам токен


def test_refresh_without_cookie_is_401(anon):
    r = anon.post("/auth/refresh")
    assert r.status_code == 401 and r.headers["www-authenticate"] == "Bearer"


def test_reusing_rotated_refresh_revokes_whole_session(anon, employee, login, Session):
    login(employee)
    stolen = refresh_cookie(anon)
    assert anon.post("/auth/refresh").status_code == 200  # легитимное обновление: stolen отозван
    newest = refresh_cookie(anon)
    anon.cookies.set(REFRESH_COOKIE_NAME, stolen, path="/auth")
    assert anon.post("/auth/refresh").status_code == 401  # повторное предъявление старого токена
    anon.cookies.set(REFRESH_COOKIE_NAME, newest, path="/auth")
    assert anon.post("/auth/refresh").status_code == 401  # новый токен той же сессии тоже отозван
    assert all(r.revoked_at is not None for r in rows(Session))


def test_expired_refresh_is_401(anon, employee):
    token, _, _ = security.create_token(employee["id"], "refresh", timedelta(seconds=-5))
    anon.cookies.set(REFRESH_COOKIE_NAME, token, path="/auth")
    r = anon.post("/auth/refresh")
    assert r.status_code == 401 and "истёк" in r.json()["detail"]


def test_refresh_expired_in_db_is_401(anon, employee, login, Session):
    login(employee)
    with Session() as s:
        s.scalars(select(models.RefreshToken)).first().expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        s.commit()
    assert anon.post("/auth/refresh").status_code == 401


def test_revoked_refresh_is_401(anon, employee, login, Session):
    login(employee)
    with Session() as s:
        s.scalars(select(models.RefreshToken)).first().revoked_at = datetime.now(timezone.utc)
        s.commit()
    assert anon.post("/auth/refresh").status_code == 401


def test_garbage_refresh_is_401_and_clears_cookie(anon):
    anon.cookies.set(REFRESH_COOKIE_NAME, "garbage", path="/auth")
    r = anon.post("/auth/refresh")
    assert r.status_code == 401
    assert "Max-Age=0" in r.headers["set-cookie"]


def test_refresh_of_disabled_user_is_401(anon, employee, login, Session):
    login(employee)
    with Session() as s:
        s.get(models.User, employee["id"]).is_active = False
        s.commit()
    assert anon.post("/auth/refresh").status_code == 401


# ---------- выход ----------
def test_logout_revokes_session_and_clears_cookie(anon, employee, login, Session):
    login(employee)
    old = refresh_cookie(anon)
    r = anon.post("/auth/logout")
    assert r.status_code == 204 and "Max-Age=0" in r.headers["set-cookie"]
    assert all(x.revoked_at is not None for x in rows(Session))
    anon.cookies.set(REFRESH_COOKIE_NAME, old, path="/auth")  # злоумышленник/клиент пробует старый токен
    assert anon.post("/auth/refresh").status_code == 401


def test_logout_without_cookie_is_ok(anon):
    assert anon.post("/auth/logout").status_code == 204


def test_logout_affects_only_current_session(employee, login, Session):
    from fastapi.testclient import TestClient

    from app.main import app

    first, second = TestClient(app), TestClient(app)
    login(employee, first)
    login(employee, second)
    first.post("/auth/logout")
    assert first.post("/auth/refresh").status_code == 401
    assert second.post("/auth/refresh").status_code == 200  # вторая сессия (другое устройство) жива


def test_logout_works_with_expired_access_token(anon, employee, login):
    login(employee)
    assert anon.post("/auth/logout", headers=bearer(security.create_access_token(employee["id"], timedelta(seconds=-5)))).status_code == 204


def test_password_hash_never_in_responses(client, make_user):
    make_user("someone@example.com")
    assert "password" not in client.get("/users").text.lower()
    assert "password" not in client.get("/auth/me").text.lower()
