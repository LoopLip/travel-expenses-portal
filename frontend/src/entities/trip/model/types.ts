export type TripStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed'

/** Соответствует TripOut в backend. */
export interface Trip {
  id: number
  destination: string
  purpose: string
  start_date: string // yyyy-mm-dd
  end_date: string
  status: TripStatus
  planned_amount: string
  user_id: number
  budget_id: number
  created_at: string
}

/** Соответствует TripCreate. */
export interface TripCreate {
  destination: string
  purpose: string
  start_date: string
  end_date: string
  planned_amount: string
  user_id: number
  budget_id: number
}

/** Соответствует TripUpdate: все поля необязательны (PATCH). */
export type TripUpdate = Partial<Omit<TripCreate, 'user_id'> & { status: TripStatus }>
