export type ExpenseCategory = 'transport' | 'lodging' | 'meals' | 'other'

/** Соответствует ExpenseOut. */
export interface Expense {
  id: number
  trip_id: number
  category: ExpenseCategory
  description: string
  amount: string
  expense_date: string
  receipt_url: string | null
}

export interface ExpenseCreate {
  trip_id: number
  category: ExpenseCategory
  description: string
  amount: string
  expense_date: string
  receipt_url: string | null
}

export type ExpenseUpdate = Partial<Omit<ExpenseCreate, 'trip_id'>>
