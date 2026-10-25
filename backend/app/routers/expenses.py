from fastapi import APIRouter, Depends, Query, Response, status

from app import crud, permissions, schemas
from app.deps import DB, CurrentUser, get_current_user
from app.models import Role

router = APIRouter(prefix="/expenses", tags=["expenses"], dependencies=[Depends(get_current_user)])
EXPENSE_WRITERS = (Role.employee, Role.manager)  # бухгалтер расходы только просматривает


@router.get("", response_model=list[schemas.ExpenseOut])
def list_expenses(
    db: DB, actor: CurrentUser, trip_id: int | None = None, skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=500)
):
    return crud.list_expenses(db, skip, limit, trip_id, permissions.owner_filter(actor))


@router.post("", response_model=schemas.ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(data: schemas.ExpenseCreate, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *EXPENSE_WRITERS)
    permissions.ensure_trip_visible(actor, crud.get_trip(db, data.trip_id))
    return crud.create_expense(db, data)


@router.get("/{expense_id}", response_model=schemas.ExpenseOut)
def get_expense(expense_id: int, db: DB, actor: CurrentUser):
    expense = crud.get_expense(db, expense_id)
    permissions.ensure_expense_visible(actor, expense)
    return expense


@router.patch("/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, data: schemas.ExpenseUpdate, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *EXPENSE_WRITERS)
    permissions.ensure_expense_visible(actor, crud.get_expense(db, expense_id))
    return crud.update_expense(db, expense_id, data)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: DB, actor: CurrentUser):
    permissions.require_role(actor, *EXPENSE_WRITERS)
    permissions.ensure_expense_visible(actor, crud.get_expense(db, expense_id))
    crud.delete_expense(db, expense_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
