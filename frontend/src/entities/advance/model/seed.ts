import type { Advance } from './types'

export const seedAdvances = (): Advance[] => [
  { id: 1, trip_id: 1, amount: '50000.00', status: 'issued', requested_at: '2026-10-05' },
  { id: 2, trip_id: 2, amount: '40000.00', status: 'requested', requested_at: '2026-10-02' },
  { id: 3, trip_id: 3, amount: '100000.00', status: 'settled', requested_at: '2026-08-25' },
]
