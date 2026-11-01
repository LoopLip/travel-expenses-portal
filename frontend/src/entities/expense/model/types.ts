export type ExpenseCategory = 'transport' | 'lodging' | 'meals' | 'other'

/** Расход (ответ ExpenseOut). */
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

/** Командировку у расхода сменить нельзя. */
export type ExpenseUpdate = Partial<Omit<ExpenseCreate, 'trip_id'>>

/** Фильтры GET /expenses. */
export interface ExpenseListFilter {
  trip_id?: number
  category?: ExpenseCategory
  q?: string
}
