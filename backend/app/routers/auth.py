from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordRequestForm

from app import auth_service, crud, schemas
from app.config import REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH, settings
from app.deps import DB, CurrentUser

router = APIRouter(prefix="/auth", tags=["auth"])

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE_NAME)]
_NO_STORE = {"Cache-Control": "no-store"}  # ответы с токенами нельзя кэшировать


def _set_refresh_cookie(response: Response, token: str) -> None:
    """Refresh-токен живёт в HttpOnly-cookie: JavaScript страницы (а значит и XSS) прочитать его не может."""
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        token,
        max_age=int(settings.refresh_token_expire_days * 86400),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
    )


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def register(data: schemas.UserRegister, db: DB):
    return auth_service.register(db, data)


@router.post("/login", response_model=schemas.TokenResponse)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], request: Request, response: Response, db: DB):
    """Вход по форме OAuth2 (поле username = email). Access-токен в теле, refresh-токен в cookie."""
    user = auth_service.authenticate(db, form.username, form.password)
    access, refresh = auth_service.start_session(db, user, request.headers.get("user-agent"))
    _set_refresh_cookie(response, refresh)
    response.headers.update(_NO_STORE)
    return schemas.TokenResponse(access_token=access, expires_in=auth_service.access_lifetime_seconds())


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(request: Request, response: Response, db: DB, refresh_token: RefreshCookie = None):
    """Обновление access-токена по refresh-cookie; refresh при этом заменяется новым (ротация)."""
    try:
        if not refresh_token:
            raise crud.AuthenticationError(auth_service.BAD_SESSION)
        _, access, new_refresh = auth_service.refresh_session(db, refresh_token, request.headers.get("user-agent"))
    except crud.AuthenticationError as exc:
        failure = JSONResponse(
            status_code=401, content={"detail": str(exc)}, headers={"WWW-Authenticate": "Bearer", **_NO_STORE}
        )
        _clear_refresh_cookie(failure)
        return failure
    _set_refresh_cookie(response, new_refresh)
    response.headers.update(_NO_STORE)
    return schemas.TokenResponse(access_token=access, expires_in=auth_service.access_lifetime_seconds())


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(db: DB, refresh_token: RefreshCookie = None):
    """Выход: отзывает сессию refresh-токена и удаляет cookie. Работает и при истёкшем access-токене."""
    auth_service.end_session(db, refresh_token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


@router.get("/me", response_model=schemas.UserOut)
def me(user: CurrentUser):
    return user
