import { MAX_LIST_LIMIT, http, mutate } from '@/shared/api'
import type { Expense, ExpenseCreate, ExpenseListFilter, ExpenseUpdate } from '../model/types'
import { toExpense, toExpenses } from './mappers'

/** Запросы к /expenses. Бухгалтер расходы только просматривает (на изменение сервер ответит 403). */
export const expenseApi = {
  list: (filter: ExpenseListFilter = {}, signal?: AbortSignal): Promise<Expense[]> =>
    http.request<unknown>('/expenses', { params: { ...filter, limit: MAX_LIST_LIMIT }, signal }).then(toExpenses),
  get: (id: number, signal?: AbortSignal): Promise<Expense> => http.request<unknown>(`/expenses/${id}`, { signal }).then(toExpense),
  create: (data: ExpenseCreate): Promise<Expense> => mutate<unknown>('/expenses', { method: 'POST', json: data }).then(toExpense),
  update: (id: number, changes: ExpenseUpdate): Promise<Expense> =>
    mutate<unknown>(`/expenses/${id}`, { method: 'PATCH', json: changes }).then(toExpense),
  remove: (id: number): Promise<void> => mutate<void>(`/expenses/${id}`, { method: 'DELETE' }),
}
