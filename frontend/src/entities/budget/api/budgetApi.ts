import { MAX_LIST_LIMIT, http, mutate } from '@/shared/api'
import type { Budget, BudgetCreate, BudgetSummary, BudgetUpdate } from '../model/types'
import { toBudget, toBudgetSummary, toBudgets } from './mappers'

/** Запросы к /budgets. Читать могут все, изменять — руководитель и бухгалтер. */
export const budgetApi = {
  list: (signal?: AbortSignal): Promise<Budget[]> =>
    http.request<unknown>('/budgets', { params: { limit: MAX_LIST_LIMIT }, signal }).then(toBudgets),
  get: (id: number, signal?: AbortSignal): Promise<Budget> => http.request<unknown>(`/budgets/${id}`, { signal }).then(toBudget),
  summary: (id: number, signal?: AbortSignal): Promise<BudgetSummary> =>
    http.request<unknown>(`/budgets/${id}/summary`, { signal }).then(toBudgetSummary),
  create: (data: BudgetCreate): Promise<Budget> => mutate<unknown>('/budgets', { method: 'POST', json: data }).then(toBudget),
  update: (id: number, changes: BudgetUpdate): Promise<Budget> =>
    mutate<unknown>(`/budgets/${id}`, { method: 'PATCH', json: changes }).then(toBudget),
  /** К бюджету с командировками сервер ответит 409. */
  remove: (id: number): Promise<void> => mutate<void>(`/budgets/${id}`, { method: 'DELETE' }),
}
