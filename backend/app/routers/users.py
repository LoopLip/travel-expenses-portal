from fastapi import APIRouter, Depends, Query, Response, status

from app import crud, permissions, schemas
from app.deps import DB, CurrentUser, get_current_user
from app.models import Role

# Все маршруты ресурса требуют access-токен.
router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(get_current_user)])


def _ensure_self_or_staff(actor, user_id: int) -> None:
    """Чужой профиль сотруднику не виден (404), руководитель и бухгалтер видят всех."""
    if actor.id != user_id and not permissions.is_staff(actor):
        raise crud.NotFoundError(f"Пользователь с id={user_id} не найден(а)")


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: DB, actor: CurrentUser, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500)):
    permissions.require_role(actor, *permissions.STAFF)
    return crud.list_users(db, skip, limit)


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: DB, actor: CurrentUser):
    _ensure_self_or_staff(actor, user_id)
    return crud.get_user(db, user_id)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: DB, actor: CurrentUser):
    """Роль и пароль здесь изменить нельзя: этих полей в схеме UserUpdate нет."""
    _ensure_self_or_staff(actor, user_id)
    return crud.update_user(db, user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: DB, actor: CurrentUser):
    permissions.require_role(actor, Role.manager)
    crud.delete_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
