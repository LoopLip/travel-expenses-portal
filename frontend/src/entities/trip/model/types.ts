export type TripStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed'

/** Командировка (ответ TripOut). Имена полей совпадают с API, суммы — строки «0.00», даты — «YYYY-MM-DD». */
export interface Trip {
  id: number
  destination: string
  purpose: string
  start_date: string
  end_date: string
  status: TripStatus
  planned_amount: string
  user_id: number
  budget_id: number
  created_at: string
}

/** Тело POST /trips. user_id не указан — командировка оформляется на текущего пользователя. */
export interface TripCreate {
  destination: string
  purpose: string
  start_date: string
  end_date: string
  planned_amount: string
  budget_id: number
  user_id?: number
}

/** Тело PATCH /trips/{id}: все поля необязательны, сотрудника сменить нельзя. */
export type TripUpdate = Partial<Omit<TripCreate, 'user_id'> & { status: TripStatus }>

/** Фильтры GET /trips (выполняются на сервере). */
export interface TripListFilter {
  status?: TripStatus
  q?: string
  user_id?: number
  budget_id?: number
}
