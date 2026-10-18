export type AdvanceStatus = 'requested' | 'issued' | 'settled'

export interface Advance {
  id: number
  tripId: number
  amount: number
  status: AdvanceStatus
  requestedAt: string
}
