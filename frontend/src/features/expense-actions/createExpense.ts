import { expenseApi } from '@/entities/expense'
import type { Expense, ExpenseCategory, ExpenseFormValues } from '@/entities/expense'
import { tripApi } from '@/entities/trip'
import { normalizeMoney } from '@/shared/lib'

/** POST /expenses: командировка должна существовать (404). */
export async function createExpense(values: ExpenseFormValues, receiptUrl: string | null): Promise<Expense> {
  const trip_id = Number(values.trip_id)
  await tripApi.get(trip_id)
  return expenseApi.create({
    trip_id,
    category: values.category as ExpenseCategory,
    description: values.description.trim(),
    amount: normalizeMoney(values.amount),
    expense_date: values.expense_date,
    receipt_url: receiptUrl,
  })
}

/** Демо-«распознавание» чека: значения фиксированные, настоящего OCR нет. */
export const DEMO_RECOGNIZED = { amount: '3450', date: '2026-10-12' }
