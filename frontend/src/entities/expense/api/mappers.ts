import { parseResponse } from '@/shared/api'
import { apiDate, apiId, apiMoney, normalizeMoney, z } from '@/shared/lib'
import { expenseCategories } from '../model/labels'
import type { ExpenseFormValues } from '../model/schema'
import type { Expense, ExpenseCategory, ExpenseCreate, ExpenseUpdate } from '../model/types'

const expenseDto = z.object({
  id: apiId,
  trip_id: apiId,
  category: z.enum(expenseCategories as [ExpenseCategory, ...ExpenseCategory[]]),
  description: z.string(),
  amount: apiMoney,
  expense_date: apiDate,
  receipt_url: z.string().nullable(),
})

// ---------- ответ сервера → модель интерфейса ----------
export const toExpense = (data: unknown): Expense => parseResponse(expenseDto, data)
export const toExpenses = (data: unknown): Expense[] => parseResponse(z.array(expenseDto), data)

// ---------- значения формы → тело запроса ----------
const fields = (v: ExpenseFormValues, receiptUrl: string | null) => ({
  category: v.category as ExpenseCategory,
  description: v.description.trim(),
  amount: normalizeMoney(v.amount),
  expense_date: v.expense_date,
  receipt_url: receiptUrl,
})

export const toExpenseCreate = (v: ExpenseFormValues, receiptUrl: string | null): ExpenseCreate => ({
  trip_id: Number(v.trip_id),
  ...fields(v, receiptUrl),
})

export const toExpenseUpdate = (v: ExpenseFormValues, receiptUrl: string | null): ExpenseUpdate => fields(v, receiptUrl)
