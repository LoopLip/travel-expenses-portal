export type AdvanceStatus = 'requested' | 'issued' | 'settled'

/** Соответствует AdvanceOut. */
export interface Advance {
  id: number
  trip_id: number
  amount: string
  status: AdvanceStatus
  requested_at: string
}

export interface AdvanceCreate {
  trip_id: number
  amount: string
}

export type AdvanceUpdate = Partial<{ amount: string; status: AdvanceStatus }>
