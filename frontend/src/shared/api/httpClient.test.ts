import { describe, expect, it, vi } from 'vitest'
import { buildQuery, createHttpClient } from './httpClient'

function memoryTokens(initial: string | null) {
  let token = initial
  return { get: () => token, set: (t: string) => { token = t }, clear: () => { token = null } }
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Поддельный backend: токен «fresh» валиден, «stale» — нет; /auth/refresh выдаёт «fresh» (или отказывает). */
function fakeBackend(options: { refreshOk?: boolean } = {}) {
  const calls: string[] = []
  const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url).replace('http://api', '')
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization
    calls.push(`${init?.method ?? 'GET'} ${path}${auth ? ` [${auth}]` : ''}`)
    if (path === '/auth/refresh') {
      await new Promise((r) => setTimeout(r, 20))
      return options.refreshOk === false ? json(401, { detail: 'Сессия недействительна. Войдите снова.' }) : json(200, { access_token: 'fresh', token_type: 'bearer', expires_in: 900 })
    }
    if (path === '/auth/login') return json(401, { detail: 'Неверный email или пароль' })
    if (path === '/users') return auth === 'Bearer fresh' ? json(200, [{ id: 1 }]) : json(401, { detail: 'Срок действия токена истёк' })
    if (path === '/forbidden') return json(403, { detail: 'Недостаточно прав для этого действия' })
    if (path === '/gone') return new Response(null, { status: 204 })
    return json(404, {})
  })
  return { fetchFn, calls }
}

function setup(token: string | null, options?: { refreshOk?: boolean }) {
  const tokens = memoryTokens(token)
  const backend = fakeBackend(options)
  const client = createHttpClient({ baseUrl: 'http://api', fetchFn: backend.fetchFn as unknown as typeof fetch, tokenStore: tokens })
  const lost = vi.fn()
  client.setAuthLostHandler(lost)
  return { client, tokens, lost, ...backend }
}

describe('HTTP-клиент: токен и обновление при 401', () => {
  it('подставляет Authorization: Bearer и отправляет cookie', async () => {
    const { client, calls, fetchFn } = setup('fresh')
    await client.request('/users')
    expect(calls).toEqual(['GET /users [Bearer fresh]'])
    expect(fetchFn.mock.calls[0][1]?.credentials).toBe('include')
  })

  it('при 401 один раз обновляет токен и повторяет запрос', async () => {
    const { client, calls, tokens } = setup('stale')
    await expect(client.request('/users')).resolves.toEqual([{ id: 1 }])
    expect(calls).toEqual(['GET /users [Bearer stale]', 'POST /auth/refresh', 'GET /users [Bearer fresh]'])
    expect(tokens.get()).toBe('fresh')
  })

  it('параллельные запросы с 401 делят ОДИН запрос обновления', async () => {
    const { client, calls } = setup('stale')
    const results = await Promise.all([client.request('/users'), client.request('/users'), client.request('/users')])
    expect(results).toHaveLength(3)
    expect(calls.filter((c) => c.startsWith('POST /auth/refresh'))).toHaveLength(1)
    expect(calls.filter((c) => c === 'GET /users [Bearer fresh]')).toHaveLength(3) // все три повторены с новым токеном
  })

  it('если обновить нельзя: очищает токен, сообщает об утрате сессии и бросает 401', async () => {
    const { client, tokens, lost } = setup('stale', { refreshOk: false })
    await expect(client.request('/users')).rejects.toMatchObject({ status: 401, message: 'Сессия истекла. Войдите снова.' })
    expect(tokens.get()).toBeNull()
    expect(lost).toHaveBeenCalledTimes(1)
  })

  it('запросы без авторизации (вход) не пытаются обновить токен', async () => {
    const { client, calls, lost } = setup(null)
    await expect(client.request('/auth/login', { method: 'POST', auth: false, form: { username: 'a', password: 'b' } })).rejects.toMatchObject({
      status: 401,
      message: 'Неверный email или пароль',
    })
    expect(calls).toEqual(['POST /auth/login'])
    expect(lost).not.toHaveBeenCalled()
  })

  it('форма входа уходит как application/x-www-form-urlencoded', async () => {
    const { client, fetchFn } = setup(null)
    await client.request('/auth/login', { method: 'POST', auth: false, form: { username: 'a@b.c', password: 'p w' } }).catch(() => undefined)
    const init = fetchFn.mock.calls[0][1]!
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('username=a%40b.c&password=p+w')
  })

  it('403 даёт понятное сообщение и не трогает токен', async () => {
    const { client, tokens, lost } = setup('fresh')
    await expect(client.request('/forbidden')).rejects.toMatchObject({ status: 403, message: 'Недостаточно прав для этого действия' })
    expect(tokens.get()).toBe('fresh')
    expect(lost).not.toHaveBeenCalled()
  })

  it('ответ 204 возвращает undefined', async () => {
    const { client } = setup('fresh')
    await expect(client.request('/gone', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('refresh() напрямую: успех сохраняет токен, повторный вызов после завершения делает новый запрос', async () => {
    const { client, calls } = setup(null)
    expect(await client.refresh()).toBe(true)
    expect(await client.refresh()).toBe(true)
    expect(calls.filter((c) => c === 'POST /auth/refresh')).toHaveLength(2)
  })
})

describe('HTTP-клиент: форматы ошибок backend и параметры запроса', () => {
  const client = (respond: (url: string) => Response | Promise<Response>) => {
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => respond(String(url)))
    return { fetchFn, http: createHttpClient({ baseUrl: 'http://api', fetchFn: fetchFn as unknown as typeof fetch, tokenStore: memoryTokens('fresh') }) }
  }

  it('422: ошибки полей переводятся на русский, ошибка модели становится общим сообщением', async () => {
    const { http } = client(() =>
      json(422, {
        detail: [
          { type: 'string_too_short', loc: ['body', 'destination'], msg: 'String should have at least 1 character', ctx: { min_length: 1 } },
          { type: 'decimal_max_places', loc: ['body', 'planned_amount'], msg: 'Decimal input should have no more than 2 decimal places', ctx: { decimal_places: 2 } },
          { type: 'value_error', loc: ['body'], msg: 'Value error, дата окончания не может быть раньше даты начала', ctx: { error: {} } },
        ],
      }),
    )
    const error = await http.request('/trips', { method: 'POST', json: {} }).catch((e: unknown) => e)
    expect(error).toMatchObject({
      status: 422,
      message: 'Дата окончания не может быть раньше даты начала',
      fieldErrors: { destination: 'Поле не может быть пустым', planned_amount: 'Не более 2 знаков после запятой' },
    })
  })

  it('422 без общих ошибок: стандартный текст «Проверьте правильность…»', async () => {
    const { http } = client(() => json(422, { detail: [{ type: 'greater_than', loc: ['body', 'amount'], msg: 'Input should be greater than 0', ctx: { gt: 0 } }] }))
    await expect(http.request('/expenses', { method: 'POST', json: {} })).rejects.toMatchObject({
      message: 'Проверьте правильность введённых данных',
      fieldErrors: { amount: 'Значение должно быть больше нуля' },
    })
  })

  it('404 — «Запись не найдена», 409 и 400 — текст сервера', async () => {
    const answers: Record<string, Response> = {
      'http://api/trips/9': json(404, { detail: 'Командировка с id=9 не найден(а)' }),
      'http://api/budgets/1': json(409, { detail: 'Нельзя удалить бюджет: к нему привязаны командировки' }),
      'http://api/advances': json(400, { detail: 'Сумма авансов (10) превышает плановую сумму командировки (0.00)' }),
    }
    const { http } = client((url) => answers[url])
    await expect(http.request('/trips/9')).rejects.toMatchObject({ status: 404, message: 'Запись не найдена' })
    await expect(http.request('/budgets/1', { method: 'DELETE' })).rejects.toMatchObject({ status: 409, message: 'Нельзя удалить бюджет: к нему привязаны командировки' })
    await expect(http.request('/advances', { method: 'POST' })).rejects.toMatchObject({ status: 400, message: /превышает плановую сумму/ })
  })

  it('403 с уточнением сервера начинается с «Недостаточно прав»', async () => {
    const { http } = client(() => json(403, { detail: 'Сотрудник не может установить этот статус командировки' }))
    await expect(http.request('/trips/1', { method: 'PATCH' })).rejects.toMatchObject({
      status: 403,
      message: 'Недостаточно прав. Сотрудник не может установить этот статус командировки',
    })
  })

  it('нет ответа сервера (fetch отклонён) — ошибка сети со статусом 0', async () => {
    const { http } = client(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(http.request('/trips')).rejects.toMatchObject({ status: 0, message: /Нет связи с сервером/ })
  })

  it('отмена запроса пробрасывается как AbortError, а не как ошибка сети', async () => {
    const { http } = client(() => Promise.reject(new DOMException('aborted', 'AbortError')))
    await expect(http.request('/trips')).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('параметры запроса: пустые значения не отправляются', async () => {
    const { http, fetchFn } = client(() => json(200, []))
    await http.request('/trips', { params: { limit: 500, status: 'draft', q: '', user_id: undefined } })
    expect(fetchFn.mock.calls[0][0]).toBe('http://api/trips?limit=500&status=draft')
    expect(buildQuery({})).toBe('')
    expect(buildQuery({ q: 'Санкт Петербург' })).toBe('?q=%D0%A1%D0%B0%D0%BD%D0%BA%D1%82+%D0%9F%D0%B5%D1%82%D0%B5%D1%80%D0%B1%D1%83%D1%80%D0%B3')
  })
})
