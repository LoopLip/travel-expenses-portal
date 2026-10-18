import type { Advance } from './types'

export const advances: Advance[] = [
  { id: 1, tripId: 1, amount: 50000, status: 'issued', requestedAt: '2026-10-05' },
  { id: 2, tripId: 2, amount: 40000, status: 'requested', requestedAt: '2026-10-02' },
  { id: 3, tripId: 3, amount: 100000, status: 'settled', requestedAt: '2026-08-25' },
]
