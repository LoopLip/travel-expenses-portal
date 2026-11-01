from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

JWT_ALGORITHM = "HS256"  # алгоритм зафиксирован в коде: из токена и настроек он не читается
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/auth"  # cookie уходит на сервер только при запросах к /auth/*
BACKEND_DIR = Path(__file__).resolve().parent.parent


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

    # --- распознавание чеков ---
    tesseract_cmd: str | None = None  # путь к tesseract.exe, если его нет в PATH
    ocr_langs: str = "rus+eng"
    upload_dir: Path = BACKEND_DIR / "uploads"
    max_receipt_mb: float = Field(default=5, gt=0)
    ocr_timeout_seconds: float = Field(default=20, gt=0)

    @field_validator("upload_dir")
    @classmethod
    def _upload_dir_absolute(cls, value: Path) -> Path:
        # относительный путь из .env считаем от папки backend, а не от текущего каталога запуска
        return value if value.is_absolute() else (BACKEND_DIR / value).resolve()

    @field_validator("tesseract_cmd")
    @classmethod
    def _empty_cmd_is_none(cls, value: str | None) -> str | None:
        return value or None

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
