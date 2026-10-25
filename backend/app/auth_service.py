"""Сценарии аутентификации: регистрация, вход, обновление токена с ротацией, выход."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import crud, models, schemas, security
from app.config import settings

BAD_CREDENTIALS = "Неверный email или пароль"  # одно сообщение для «нет такого email» и «неверный пароль»
BAD_SESSION = "Сессия недействительна. Войдите снова."
SESSION_EXPIRED = "Срок действия сессии истёк. Войдите снова."


def _now() -> datetime:
    return datetime.now(timezone.utc)


def register(db: Session, data: schemas.UserRegister) -> models.User:
    """Роль при саморегистрации всегда employee; повысить её через API нельзя."""
    return crud.create_user(db, data, security.hash_password(data.password), models.Role.employee)


def authenticate(db: Session, email: str, password: str) -> models.User:
    user = db.scalar(select(models.User).where(models.User.email == email.strip().lower()))
    if user is None:
        security.verify_dummy(password)
        raise crud.AuthenticationError(BAD_CREDENTIALS)
    if not security.verify_password(password, user.password_hash):
        raise crud.AuthenticationError(BAD_CREDENTIALS)
    if not user.is_active:
        raise crud.AuthenticationError("Учётная запись отключена")
    return user


def _issue_refresh(db: Session, user: models.User, family_id: str, user_agent: str | None) -> str:
    token, jti, expires_at = security.create_refresh_token(user.id)
    db.add(
        models.RefreshToken(
            user_id=user.id,
            jti=jti,
            family_id=family_id,
            token_hash=security.hash_token(token),
            expires_at=expires_at,
            user_agent=(user_agent or "")[:255] or None,
        )
    )
    return token


def start_session(db: Session, user: models.User, user_agent: str | None) -> tuple[str, str]:
    """Новый вход = новая сессия (family_id). Возвращает (access, refresh)."""
    refresh = _issue_refresh(db, user, str(uuid.uuid4()), user_agent)
    db.commit()
    return security.create_access_token(user.id), refresh


def _revoke_family(db: Session, family_id: str) -> None:
    db.execute(
        update(models.RefreshToken)
        .where(models.RefreshToken.family_id == family_id, models.RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


def _load_refresh(db: Session, token: str) -> tuple[dict, models.RefreshToken]:
    """Проверяет подпись/срок/тип токена и находит его запись в БД (с блокировкой строки)."""
    try:
        payload = security.decode_token(token, "refresh")
    except security.TokenError as exc:
        raise crud.AuthenticationError(SESSION_EXPIRED if exc.reason == "expired" else BAD_SESSION) from exc
    row = db.scalar(select(models.RefreshToken).where(models.RefreshToken.jti == payload["jti"]).with_for_update())
    if row is None or row.token_hash != security.hash_token(token):
        raise crud.AuthenticationError(BAD_SESSION)
    return payload, row


def refresh_session(db: Session, token: str, user_agent: str | None) -> tuple[models.User, str, str]:
    """Ротация: старый refresh отзывается, выдаётся новый в той же сессии.

    Повторное предъявление уже отозванного токена считается кражей/гонкой: отзывается вся сессия.
    """
    _, row = _load_refresh(db, token)
    if row.revoked_at is not None:
        _revoke_family(db, row.family_id)
        db.commit()
        raise crud.AuthenticationError(BAD_SESSION)
    if row.expires_at <= _now():
        raise crud.AuthenticationError(SESSION_EXPIRED)
    user = db.get(models.User, row.user_id)
    if user is None or not user.is_active:
        raise crud.AuthenticationError(BAD_SESSION)
    row.revoked_at = _now()
    new_refresh = _issue_refresh(db, user, row.family_id, user_agent)
    db.commit()
    return user, security.create_access_token(user.id), new_refresh


def end_session(db: Session, token: str | None) -> None:
    """Выход: отзывает всю сессию, к которой относится refresh-токен. Некорректный токен игнорируется."""
    if not token:
        return
    try:
        _, row = _load_refresh(db, token)
    except crud.AuthenticationError:
        db.rollback()
        return
    _revoke_family(db, row.family_id)
    db.commit()


def access_lifetime_seconds() -> int:
    return int(settings.access_token_expire_minutes * 60)
