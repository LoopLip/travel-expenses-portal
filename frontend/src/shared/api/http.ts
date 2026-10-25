import { API_URL } from './config'
import { createHttpClient } from './httpClient'
import { tokenStore } from './tokenStore'

/** Общий клиент приложения: реальный fetch, адрес backend из настроек, токен в памяти. */
export const http = createHttpClient({ baseUrl: API_URL, fetchFn: (...args) => fetch(...args), tokenStore })
