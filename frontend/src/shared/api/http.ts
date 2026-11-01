import { notifyDataChanged } from './bus'
import { API_URL } from './config'
import { createHttpClient } from './httpClient'
import type { RequestOptions } from './httpClient'
import { tokenStore } from './tokenStore'

/** Общий клиент приложения: реальный fetch, адрес backend из настроек, токен в памяти. */
export const http = createHttpClient({ baseUrl: API_URL, fetchFn: (...args) => fetch(...args), tokenStore })

/**
 * Изменяющий запрос (POST, PATCH, DELETE). После успеха сообщает всем открытым экранам, что данные изменились,
 * и они загружают их заново: список, карточка, суммы командировки и использование бюджета обновляются без F5.
 */
export async function mutate<T>(path: string, opts: RequestOptions & { method: 'POST' | 'PATCH' | 'DELETE' }): Promise<T> {
  const result = await http.request<T>(path, opts)
  notifyDataChanged()
  return result
}
