export type TripStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'completed'

export interface Trip {
  id: number
  destination: string
  purpose: string
  startDate: string // ISO yyyy-mm-dd
  endDate: string
  status: TripStatus
  employee: string
  budgetId: number
  plannedAmount: number
}
