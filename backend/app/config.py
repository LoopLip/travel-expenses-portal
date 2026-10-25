from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

JWT_ALGORITHM = "HS256"  # алгоритм зафиксирован в коде: из токена и настроек он не читается
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth"  # cookie уходит на сервер только при запросах к /auth/*


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # --- аутентификация ---
    jwt_secret: str
    access_token_expire_minutes: float = Field(default=15, gt=0)
    refresh_token_expire_days: float = Field(default=7, gt=0)
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    @field_validator("jwt_secret")
    @classmethod
    def _secret_is_long_enough(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("JWT_SECRET должен быть не короче 32 символов")
        return value

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()  # type: ignore[call-arg]
