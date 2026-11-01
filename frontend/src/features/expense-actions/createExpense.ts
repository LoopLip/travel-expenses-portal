import { expenseApi, toExpenseCreate } from '@/entities/expense'
import type { Expense, ExpenseFormValues } from '@/entities/expense'

/** POST /expenses: командировка должна быть доступна текущему пользователю (иначе сервер ответит 404). */
export const createExpense = (values: ExpenseFormValues, receiptUrl: string | null): Promise<Expense> =>
  expenseApi.create(toExpenseCreate(values, receiptUrl))

/** Демо-«распознавание» чека: значения фиксированные, настоящего OCR нет (функция-имитация из ЛР №1). */
export const DEMO_RECOGNIZED = { amount: '3450', date: '2026-10-12' }
