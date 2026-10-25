from fastapi import APIRouter, Depends, Query, Response, status

from app import crud, permissions, schemas
from app.deps import DB, CurrentUser, get_current_user
from app.models import Role

router = APIRouter(prefix="/advances", tags=["advances"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[schemas.AdvanceOut])
def list_advances(
    db: DB, actor: CurrentUser, trip_id: int | None = None, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500)
):
    return crud.list_advances(db, skip, limit, trip_id, permissions.owner_filter(actor))


@router.post("", response_model=schemas.AdvanceOut, status_code=status.HTTP_201_CREATED)
def create_advance(data: schemas.AdvanceCreate, db: DB, actor: CurrentUser):
    permissions.ensure_trip_visible(actor, crud.get_trip(db, data.trip_id))
    return crud.create_advance(db, data)


@router.get("/{advance_id}", response_model=schemas.AdvanceOut)
def get_advance(advance_id: int, db: DB, actor: CurrentUser):
    advance = crud.get_advance(db, advance_id)
    permissions.ensure_advance_visible(actor, advance)
    return advance


@router.patch("/{advance_id}", response_model=schemas.AdvanceOut)
def update_advance(advance_id: int, data: schemas.AdvanceUpdate, db: DB, actor: CurrentUser):
    permissions.ensure_advance_visible(actor, crud.get_advance(db, advance_id))
    if data.status is not None:  # выдавать и закрывать авансы может только бухгалтер
        permissions.require_role(actor, Role.accountant)
    return crud.update_advance(db, advance_id, data)


@router.delete("/{advance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_advance(advance_id: int, db: DB, actor: CurrentUser):
    permissions.ensure_advance_visible(actor, crud.get_advance(db, advance_id))
    crud.delete_advance(db, advance_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
