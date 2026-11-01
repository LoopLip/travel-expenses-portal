import { ApiError, VALIDATION_MESSAGE, isAbortError, networkError } from './errors'
import { isValidationList, translateValidation } from './validation'

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
  /** Тело multipart/form-data (загрузка файла). FormData можно отправить повторно — повтор после обновления токена работает. */
  formData?: FormData
  /** blob — ответ-файл (например, изображение чека) вместо JSON. */
  responseType?: 'json' | 'blob'
  /** false — запрос без токена и без попытки обновления (вход, регистрация, обновление токена). */
  auth?: boolean
  /** Параметры строки запроса; пустые значения (undefined, null, '') не отправляются. */
  params?: QueryParams
  /** Отмена запроса (например, когда пользователь сменил фильтр и прежний ответ уже не нужен). */
  signal?: AbortSignal
}

export type QueryParams = Record<string, string | number | null | undefined>

/** Строка запроса из параметров: buildQuery({ status: 'draft', q: '' }) → '?status=draft'. */
export function buildQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
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
  422: VALIDATION_MESSAGE,
}

/**
 * Понятная ошибка из ответа backend. Форматы: {"detail": "строка"} (400, 401, 403, 404, 409)
 * и {"detail": [{type, loc, msg, ctx}]} (422) — второй переводится на русский и раскладывается по полям формы.
 */
export async function readError(res: Response): Promise<ApiError> {
  let detail: unknown
  try {
    detail = ((await res.json()) as { detail?: unknown }).detail
  } catch {
    detail = undefined
  }
  if (res.status === 422 && isValidationList(detail)) {
    const { fieldErrors, formErrors } = translateValidation(detail)
    return new ApiError(422, formErrors[0] ?? FALLBACK_MESSAGES[422], fieldErrors)
  }
  // 404 не уточняем: для сотрудника чужая запись тоже «не найдена» (backend не раскрывает, что она существует)
  if (res.status === 404) return new ApiError(404, FALLBACK_MESSAGES[404])
  if (res.status === 403 && typeof detail === 'string' && detail && !detail.startsWith('Недостаточно прав')) {
    return new ApiError(403, `Недостаточно прав. ${detail}`)
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
    } else if (opts.formData) {
      // Content-Type не задаём: браузер сам выставит multipart/form-data с границей (boundary)
      body = opts.formData
    }
    const token = tokenStore.get()
    if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`
    const url = `${baseUrl}${path}${buildQuery(opts.params)}`
    // fetch отклоняет промис только без ответа сервера (сеть, CORS, backend выключен) или при отмене запроса
    return fetchFn(url, { method: opts.method ?? 'GET', headers, body, credentials: 'include', signal: opts.signal }).catch((e: unknown) => {
      throw isAbortError(e) ? e : networkError()
    })
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
    } catch (e) {
      // нет связи с сервером: сессию не сбрасываем, запрос завершится ошибкой сети
      if (e instanceof ApiError) throw e
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
    if (opts.responseType === 'blob') return (await res.blob()) as T
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
