from fastapi import APIRouter, Depends, Query, Response, status

from app import crud, models, permissions, schemas
from app.deps import DB, CurrentUser, get_current_user
from app.models import Role

router = APIRouter(prefix="/trips", tags=["trips"], dependencies=[Depends(get_current_user)])
TRIP_WRITERS = (Role.employee, Role.manager)  # бухгалтер командировки не создаёт и не изменяет


@router.get("", response_model=list[schemas.TripOut])
def list_trips(
    db: DB,
    actor: CurrentUser,
    status: models.TripStatus | None = None,
    user_id: int | None = None,
    budget_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    # Сотрудник всегда видит только свои командировки, параметр user_id для него игнорируется.
    owner = permissions.owner_filter(actor)
    return crud.list_trips(db, skip, limit, status, owner if owner is not None else user_id, budget_id)


@router.post("", response_model=schemas.TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(data: schemas.TripCreate, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *TRIP_WRITERS)
    target = data.user_id if data.user_id is not None else actor.id
    if actor.role == Role.employee and target != actor.id:
        raise crud.ForbiddenError("Нельзя оформлять командировку за другого сотрудника")
    return crud.create_trip(db, data, target)


@router.get("/{trip_id}", response_model=schemas.TripDetail)
def get_trip(trip_id: int, db: DB, actor: CurrentUser):
    trip = crud.get_trip(db, trip_id)
    permissions.ensure_trip_visible(actor, trip)
    return trip


@router.patch("/{trip_id}", response_model=schemas.TripOut)
def update_trip(trip_id: int, data: schemas.TripUpdate, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *TRIP_WRITERS)
    permissions.ensure_trip_visible(actor, crud.get_trip(db, trip_id))
    permissions.ensure_trip_status_allowed(actor, data.status)
    return crud.update_trip(db, trip_id, data)


@router.delete("/{trip_id}", status_code=204)
def delete_trip(trip_id: int, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *TRIP_WRITERS)
    permissions.ensure_trip_visible(actor, crud.get_trip(db, trip_id))
    crud.delete_trip(db, trip_id)
    return Response(status_code=204)
