from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import crud, models  # noqa: F401  (models нужны, чтобы таблицы попали в metadata)
from app.config import settings
from app.db import Base, engine
from app.routers import advances, auth, budgets, expenses, trips, users


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Простое создание таблиц без миграций (см. README). Существующие таблицы не изменяются.
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Портал командировок и расходов", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,  # нужно, чтобы браузер отправлял и принимал cookie с refresh-токеном
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def _error(status_code: int):
    async def handler(_: Request, exc: Exception):
        return JSONResponse(status_code=status_code, content={"detail": str(exc)})

    return handler


app.add_exception_handler(crud.NotFoundError, _error(404))
app.add_exception_handler(crud.ConflictError, _error(409))
app.add_exception_handler(crud.BusinessRuleError, _error(400))
app.add_exception_handler(crud.ForbiddenError, _error(403))


async def _unauthorized(_: Request, exc: Exception):
    return JSONResponse(status_code=401, content={"detail": str(exc)}, headers={"WWW-Authenticate": "Bearer"})


app.add_exception_handler(crud.AuthenticationError, _unauthorized)

for r in (auth, users, budgets, trips, advances, expenses):
    app.include_router(r.router)


@app.get("/health", tags=["service"])
def health():
    return {"status": "ok"}
