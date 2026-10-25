"""Зависимости FastAPI: сессия БД и текущий пользователь."""
from typing import Annotated

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app import crud, models, security
from app.db import get_db

DB = Annotated[Session, Depends(get_db)]

# auto_error=False: об отсутствии токена сообщаем сами (401 с понятным текстом и заголовком WWW-Authenticate).
# Благодаря этой схеме в Swagger появляется кнопка Authorize.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(token: Annotated[str | None, Depends(oauth2_scheme)], db: DB) -> models.User:
    if not token:
        raise crud.AuthenticationError("Требуется авторизация")
    try:
        payload = security.decode_token(token, "access")
    except security.TokenError as exc:
        message = "Срок действия токена истёк" if exc.reason == "expired" else "Недействительный токен"
        raise crud.AuthenticationError(message) from exc
    try:
        user_id = int(payload["sub"])
    except ValueError as exc:
        raise crud.AuthenticationError("Недействительный токен") from exc
    user = db.get(models.User, user_id)
    if user is None or not user.is_active:
        raise crud.AuthenticationError("Пользователь не найден или отключён")
    return user


CurrentUser = Annotated[models.User, Depends(get_current_user)]
