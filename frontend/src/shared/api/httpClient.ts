import { ApiError } from './errors'

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** Тело JSON. */
  json?: unknown
  /** Тело формы (application/x-www-form-urlencoded), например для входа. */
  form?: Record<string, string>
  /** false — запрос без токена и без попытки обновления (вход, регистрация, обновление токена). */
  auth?: boolean
}

export interface HttpClientDeps {
  baseUrl: string
  fetchFn: typeof fetch
  tokenStore: { get: () => string | null; set: (t: string) => void; clear: () => void }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: 'Требуется вход в систему',
  403: 'Недостаточно прав для этого действия',
  404: 'Запись не найдена',
  409: 'Операция конфликтует с текущими данными',
  422: 'Проверьте правильность введённых данных',
}

/** Достаёт понятный текст ошибки из ответа backend ({"detail": "..."} или список ошибок валидации). */
export async function readError(res: Response): Promise<ApiError> {
  let detail: unknown
  try {
    detail = ((await res.json()) as { detail?: unknown }).detail
  } catch {
    detail = undefined
  }
  if (typeof detail === 'string' && detail) return new ApiError(res.status, detail)
  if (res.status >= 500) return new ApiError(res.status, 'Ошибка сервера. Попробуйте позже')
  return new ApiError(res.status, FALLBACK_MESSAGES[res.status] ?? `Ошибка запроса (${res.status})`)
}

/**
 * HTTP-клиент: подставляет Authorization: Bearer, при 401 один раз обновляет токен и повторяет запрос.
 * Если несколько запросов одновременно получили 401, обновление выполняется ОДНИМ запросом, остальные ждут его результата
 * (иначе второй refresh с уже использованным токеном был бы принят за кражу и отозвал бы сессию).
 */
export function createHttpClient({ baseUrl, fetchFn, tokenStore }: HttpClientDeps) {
  let inflightRefresh: Promise<boolean> | null = null
  let onAuthLost: () => void = () => undefined

  const send = (path: string, opts: RequestOptions): Promise<Response> => {
    const headers: Record<string, string> = {}
    let body: BodyInit | undefined
    if (opts.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(opts.json)
    } else if (opts.form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(opts.form).toString()
    }
    const token = tokenStore.get()
    if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`
    return fetchFn(`${baseUrl}${path}`, { method: opts.method ?? 'GET', headers, body, credentials: 'include' })
  }

  const doRefresh = async (): Promise<boolean> => {
    try {
      const res = await send('/auth/refresh', { method: 'POST', auth: false })
      if (!res.ok) {
        tokenStore.clear()
        return false
      }
      tokenStore.set(((await res.json()) as TokenResponse).access_token)
      return true
    } catch {
      return false
    }
  }

  /** Обновить access-токен по refresh-cookie. Параллельные вызовы делят один запрос. */
  const refresh = (): Promise<boolean> => {
    if (!inflightRefresh) {
      inflightRefresh = doRefresh().finally(() => {
        inflightRefresh = null
      })
    }
    return inflightRefresh
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    let res = await send(path, opts)
    if (res.status === 401 && opts.auth !== false) {
      if (await refresh()) res = await send(path, opts)
      if (res.status === 401) {
        tokenStore.clear()
        onAuthLost()
        throw new ApiError(401, 'Сессия истекла. Войдите снова.')
      }
    }
    if (!res.ok) throw await readError(res)
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  return {
    request,
    refresh,
    /** Вызывается, когда сессию восстановить нельзя (refresh отозван или истёк). */
    setAuthLostHandler: (handler: () => void) => {
      onAuthLost = handler
    },
  }
}
