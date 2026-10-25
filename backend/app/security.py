"""Криптография аутентификации: хеширование паролей (argon2id) и JWT-токены (PyJWT, HS256)."""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import JWT_ALGORITHM, settings

TokenType = Literal["access", "refresh"]

# argon2id с параметрами библиотеки по умолчанию. Соль генерируется случайно для каждого пароля
# и хранится внутри самой строки хеша ($argon2id$v=19$m=...,t=...,p=...$соль$хеш).
hasher = PasswordHasher()

# Хеш «пустышки»: проверяется, когда пользователя с таким email нет, чтобы время ответа
# не выдавало, существует ли адрес.
_DUMMY_HASH = hasher.hash("not-a-real-password")


class TokenError(Exception):
    """Токен непригоден. reason: expired (истёк) или invalid (подделан, неверного вида/типа)."""

    def __init__(self, reason: Literal["expired", "invalid"]):
        super().__init__(reason)
        self.reason = reason


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_dummy(password: str) -> None:
    """Тратит столько же времени, сколько обычная проверка пароля."""
    verify_password(password, _DUMMY_HASH)


def hash_token(token: str) -> str:
    """SHA-256 токена: в БД хранится только он, сам refresh-токен восстановить из него нельзя."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_token(
    user_id: int, token_type: TokenType, expires_delta: timedelta, jti: str | None = None
) -> tuple[str, str, datetime]:
    """Возвращает (токен, jti, момент истечения). Claims: sub, type, iat, exp, jti."""
    now = datetime.now(timezone.utc)
    expires_at = now + expires_delta
    jti = jti or str(uuid.uuid4())
    payload = {"sub": str(user_id), "type": token_type, "iat": now, "exp": expires_at, "jti": jti}
    return jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM), jti, expires_at


def create_access_token(user_id: int, expires_delta: timedelta | None = None) -> str:
    delta = expires_delta if expires_delta is not None else timedelta(minutes=settings.access_token_expire_minutes)
    return create_token(user_id, "access", delta)[0]


def create_refresh_token(user_id: int) -> tuple[str, str, datetime]:
    return create_token(user_id, "refresh", timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str, expected_type: TokenType) -> dict:
    """Проверяет подпись, срок и тип. Алгоритм задан явно: токен с alg=none или другим отвергается."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "iat", "sub", "jti", "type"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("expired") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("invalid") from exc
    if payload.get("type") != expected_type:
        raise TokenError("invalid")  # refresh нельзя использовать как access и наоборот
    return payload
