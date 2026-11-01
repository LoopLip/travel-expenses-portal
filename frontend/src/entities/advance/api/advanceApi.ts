import { MAX_LIST_LIMIT, http, mutate } from '@/shared/api'
import type { Advance, AdvanceCreate, AdvanceListFilter, AdvanceUpdate } from '../model/types'
import { toAdvance, toAdvances } from './mappers'

/** Запросы к /advances. Лимит «сумма авансов ≤ плановой суммы» проверяет сервер (400). */
export const advanceApi = {
  list: (filter: AdvanceListFilter = {}, signal?: AbortSignal): Promise<Advance[]> =>
    http.request<unknown>('/advances', { params: { ...filter, limit: MAX_LIST_LIMIT }, signal }).then(toAdvances),
  get: (id: number, signal?: AbortSignal): Promise<Advance> => http.request<unknown>(`/advances/${id}`, { signal }).then(toAdvance),
  create: (data: AdvanceCreate): Promise<Advance> => mutate<unknown>('/advances', { method: 'POST', json: data }).then(toAdvance),
  update: (id: number, changes: AdvanceUpdate): Promise<Advance> =>
    mutate<unknown>(`/advances/${id}`, { method: 'PATCH', json: changes }).then(toAdvance),
  remove: (id: number): Promise<void> => mutate<void>(`/advances/${id}`, { method: 'DELETE' }),
}
