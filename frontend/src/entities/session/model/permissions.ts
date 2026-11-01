import type { SessionUser } from './types'
import { useSession } from './SessionContext'

/**
 * Права ролей в интерфейсе — копия правил backend (backend/app/permissions.py и routers/*.py).
 * Интерфейс по ним только скрывает недоступные кнопки; окончательно решает сервер (403 или 404).
 * Записи передаются как { user_id } — владелец командировки, чтобы не зависеть от типов других сущностей.
 */
type Owned = { user_id: number }

/** Статусы, которые сотрудник может ставить своей командировке (EMPLOYEE_ALLOWED_STATUSES). */
export const EMPLOYEE_TRIP_STATUSES = ['draft', 'pending'] as const

const isOwner = (user: SessionUser, record: Owned) => record.user_id === user.id

export const can = {
  /** POST /trips: сотрудник (на себя) и руководитель (на любого); бухгалтер — нет. */
  createTrip: (user: SessionUser) => user.role !== 'accountant',
  /** Поле «Сотрудник» в форме: только руководитель оформляет командировку за другого. */
  chooseTripEmployee: (user: SessionUser) => user.role === 'manager',
  /** PATCH и DELETE /trips/{id}: руководитель — любые, сотрудник — свои. */
  editTrip: (user: SessionUser, trip: Owned) => user.role === 'manager' || (user.role === 'employee' && isOwner(user, trip)),
  /** Какие статусы можно установить: руководитель — любые, сотрудник своей — черновик и «на согласовании». */
  tripStatuses: (user: SessionUser, trip: Owned): 'all' | readonly string[] =>
    user.role === 'manager' ? 'all' : user.role === 'employee' && isOwner(user, trip) ? EMPLOYEE_TRIP_STATUSES : [],
  /** POST /advances, PATCH {amount}, DELETE: любой, кому видна командировка. */
  writeAdvance: (_user: SessionUser) => true,
  /** PATCH /advances/{id} {status}: только бухгалтер. */
  changeAdvanceStatus: (user: SessionUser) => user.role === 'accountant',
  /** POST, PATCH, DELETE /expenses: сотрудник (свои) и руководитель; бухгалтер только просматривает. */
  writeExpense: (user: SessionUser) => user.role !== 'accountant',
  /** POST, PATCH, DELETE /budgets: руководитель и бухгалтер. */
  manageBudgets: (user: SessionUser) => user.role === 'manager' || user.role === 'accountant',
  /** GET /users: руководитель и бухгалтер. */
  viewUsers: (user: SessionUser) => user.role === 'manager' || user.role === 'accountant',
}

/** Права текущего пользователя: const allow = usePermissions(); allow.editTrip(trip). Без входа — всё запрещено. */
export function usePermissions() {
  const { user } = useSession()
  return {
    createTrip: () => Boolean(user && can.createTrip(user)),
    chooseTripEmployee: () => Boolean(user && can.chooseTripEmployee(user)),
    editTrip: (trip: Owned) => Boolean(user && can.editTrip(user, trip)),
    tripStatuses: (trip: Owned) => (user ? can.tripStatuses(user, trip) : []),
    writeAdvance: () => Boolean(user && can.writeAdvance(user)),
    changeAdvanceStatus: () => Boolean(user && can.changeAdvanceStatus(user)),
    writeExpense: () => Boolean(user && can.writeExpense(user)),
    manageBudgets: () => Boolean(user && can.manageBudgets(user)),
    viewUsers: () => Boolean(user && can.viewUsers(user)),
  }
}
