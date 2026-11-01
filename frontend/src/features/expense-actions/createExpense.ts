import { expenseApi, toExpenseCreate } from '@/entities/expense'
import type { Expense, ExpenseFormValues } from '@/entities/expense'

/** POST /expenses: командировка должна быть доступна текущему пользователю (иначе сервер ответит 404). */
export const createExpense = (values: ExpenseFormValues, receiptUrl: string | null): Promise<Expense> =>
  expenseApi.create(toExpenseCreate(values, receiptUrl))
