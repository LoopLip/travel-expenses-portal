export type ExpenseCategory = 'transport' | 'lodging' | 'meals' | 'other'

export interface Expense {
  id: number
  tripId: number
  category: ExpenseCategory
  description: string
  amount: number
  date: string
  hasReceipt: boolean
}
