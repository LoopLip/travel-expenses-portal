// Сквозная проверка приложения в браузере (Playwright + установленный Chrome) на РЕАЛЬНОМ backend и PostgreSQL.
// Требуется: БД, backend (для проверки тихого обновления токена — с ACCESS_TOKEN_EXPIRE_MINUTES=0.1) и `npm run dev`.
// Запуск: `npm run e2e`. Переменные: BASE_URL (http://127.0.0.1:5173), API_URL (http://127.0.0.1:8000), CHROME_PATH,
// TOKEN_WAIT_MS (ожидание истечения access-токена, по умолчанию 8000; 0 — пропустить шаг).
// Каждый прогон создаёт своих пользователей и записи с уникальной меткой, поэтому не зависит от данных в БД и не мешает им.
import { chromium } from 'playwright-core'
import { API, apiLogin, ensureBackend, loginUi as loginUiRaw, provisionUsers } from './e2e-env.mjs'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const tokenWait = Number(process.env.TOKEN_WAIT_MS ?? 8000)

const results = []
const consoleErrors = []

async function step(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log('OK   ' + name)
  } catch (e) {
    results.push({ name, ok: false })
    console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n')[0])
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

await ensureBackend()
const users = await provisionUsers()
const stamp = Date.now().toString(36)
const browser = await chromium.launch({ executablePath: chromePath })
const loginUi = (page, user) => loginUiRaw(page, base, user)
// Ожидаемые отказы backend (бизнес-правило, неверный пароль, гость, чужие данные, конфликт) и намеренно оборванные запросы
// браузер пишет в консоль как «Failed to load resource» — это не ошибки приложения.
const EXPECTED = /Failed to load resource: (the server responded with a status of (400|401|403|404|409)|net::ERR_FAILED)/

async function newPage(viewport = { width: 1366, height: 800 }, options = {}) {
  const ctx = await browser.newContext({ viewport, ...options })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !EXPECTED.test(m.text())) consoleErrors.push(m.text()) })
  return { ctx, page }
}
const snackbar = (page, text) => page.getByTestId('snackbar').filter({ hasText: text }).waitFor()
const h1 = (page) => page.locator('h1').first()
const rows = (page, testId, text) => page.getByTestId(testId).filter({ hasText: text })
const api = async (token, method, path, body) => {
  const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) })
  return { status: res.status, body: res.status === 204 ? null : await res.json() }
}

// Бюджет для прогона создаёт руководитель через API (как подготовка данных).
// Access-токен при ACCESS_TOKEN_EXPIRE_MINUTES=0.1 живёт 6 секунд, поэтому для каждого вызова API входим заново.
const managerToken = async () => (await apiLogin(users.manager)).access
const budget = (await api(await managerToken(), 'POST', '/budgets', { department: `E2E ${stamp}`, period: '2026-Q4', limit_amount: '500000' })).body
const fresh = { name: `Новый Сотрудник ${stamp}`, email: `e2e-${stamp}-new@example.com`, password: 'Pw-new-' + Math.random().toString(36).slice(2, 12) }
const tripName = `Тестоград ${stamp}`
let tripId = 0

// ---------------------------------------------------------------- 1. основной сценарий сотрудника
{
  const { ctx, page } = await newPage()
  await step('Регистрация через интерфейс и автоматический вход', async () => {
    await page.goto(base + '/register')
    await page.getByLabel('Имя и фамилия').fill(fresh.name)
    await page.getByLabel('Email').fill(fresh.email)
    await page.getByLabel('Пароль', { exact: true }).fill(fresh.password)
    await page.getByLabel('Повторите пароль').fill(fresh.password)
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.getByTestId('user-menu').waitFor()
  })
  await step('Пустой список у нового сотрудника: понятный текст и кнопка', async () => {
    await page.goto(base + '/trips')
    await page.getByText('Командировок пока нет').waitFor()
    await page.getByTestId('state-empty').getByRole('link', { name: 'Новая заявка' }).waitFor()
  })
  await step('Создание командировки: поля «Сотрудник» нет, ошибки валидации, блокировка кнопки', async () => {
    await page.goto(base + '/trips/new')
    await page.getByLabel('Направление').waitFor()
    assert((await page.getByLabel('Сотрудник').count()) === 0, 'сотрудник не выбирает, на кого оформлять')
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await page.getByText('Укажите: направление').waitFor()
    await page.getByLabel('Направление').fill(tripName)
    await page.getByLabel('Цель поездки').fill('Проверка интеграции')
    await page.getByLabel('Дата начала').fill('2026-12-10')
    await page.getByLabel('Дата окончания').fill('2026-12-12')
    await page.getByLabel('Плановая сумма, ₽').fill('72000')
    await page.getByLabel('Бюджет').click()
    await page.getByRole('option', { name: new RegExp(`E2E ${stamp}`) }).click()
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await snackbar(page, 'Командировка создана')
    await h1(page).filter({ hasText: tripName }).waitFor()
    tripId = Number(new URL(page.url()).pathname.split('/').pop())
    assert(tripId > 0, 'ожидали переход в карточку')
  })
  await step('Командировка в списке и после F5 (данные лежат в PostgreSQL)', async () => {
    await page.goto(base + '/trips')
    await rows(page, 'trip-row', tripName).waitFor()
    await page.reload()
    await rows(page, 'trip-row', tripName).waitFor()
    const fromApi = await api((await apiLogin(fresh)).access, 'GET', `/trips/${tripId}`)
    assert(fromApi.status === 200 && fromApi.body.destination === tripName, 'командировки нет на сервере')
  })
  await step('Редактирование командировки', async () => {
    await rows(page, 'trip-row', tripName).getByRole('button', { name: 'Редактировать' }).click()
    await page.getByLabel('Цель поездки').fill('Проверка интеграции (изменено)')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await snackbar(page, 'Командировка сохранена')
    await page.getByRole('button', { name: 'Подробнее' }).click()
    await page.getByText('Проверка интеграции (изменено)').waitFor()
  })
  await step('Аванс: лимит проверяется в форме; после запроса обновляется сводка', async () => {
    await page.getByRole('button', { name: 'Запросить аванс' }).click()
    await page.getByLabel('Сумма аванса, ₽').fill('80000')
    await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
    await page.getByText(/превышает плановую сумму командировки/).waitFor()
    await page.getByLabel('Сумма аванса, ₽').fill('30000')
    await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
    await snackbar(page, 'Аванс запрошен')
    await page.getByTestId('advance-item').first().waitFor()
    await page.getByRole('tab', { name: 'Сводка' }).click()
    await page.getByText('Можно запросить ещё').locator('..').getByText(/42\s000/).waitFor()
  })
  await step('Изменение суммы аванса', async () => {
    await page.getByRole('tab', { name: /Авансы/ }).click()
    await page.getByRole('button', { name: 'Изменить аванс' }).click()
    await page.getByLabel('Сумма аванса, ₽').fill('35000')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Аванс изменён')
    await page.getByTestId('advance-item').filter({ hasText: /35\s000/ }).waitFor()
  })
  await step('Плановую сумму нельзя снизить ниже авансов: сообщение сервера (400) под формой', async () => {
    await page.goto(`${base}/trips/${tripId}/edit`)
    await page.getByLabel('Плановая сумма, ₽').fill('1000')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await page.getByTestId('form-server-error').filter({ hasText: 'Плановая сумма не может быть меньше суммы авансов' }).waitFor()
    await page.getByRole('button', { name: 'Отмена' }).click()
  })
  await step('Расход: добавление, изменение (суммы обновляются без перезагрузки), удаление', async () => {
    await page.goto(`${base}/trips/${tripId}`)
    await page.getByRole('tab', { name: /Расходы/ }).click()
    await page.getByRole('button', { name: 'Добавить расход' }).click()
    await page.getByLabel('Описание').fill('Такси')
    await page.getByLabel('Сумма, ₽').fill('1200,50')
    await page.getByLabel('Дата').fill('2026-12-10')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Расход добавлен')
    await page.getByTestId('expense-item').filter({ hasText: 'Такси' }).waitFor()
    await page.getByRole('tab', { name: /Расходы \(1\)/ }).waitFor()
    await page.getByRole('button', { name: 'Изменить расход' }).click()
    await page.getByLabel('Описание').fill('Такси до аэропорта')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Расход сохранён')
    await page.getByTestId('expense-item').filter({ hasText: 'Такси до аэропорта' }).waitFor()
    await page.getByRole('tab', { name: 'Сводка' }).click()
    await page.getByText('Расходы', { exact: true }).locator('..').getByText(/1\s200,5/).waitFor()
    await page.getByRole('tab', { name: /Расходы/ }).click()
    await page.getByRole('button', { name: 'Удалить расход' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
    await snackbar(page, 'Расход удалён')
    await page.getByText('Расходов пока нет').waitFor()
  })
  await step('Сотрудник отправляет заявку на согласование: доступны только «Черновик» и «На согласовании»', async () => {
    await page.getByRole('button', { name: 'Изменить статус' }).click()
    const items = await page.getByRole('menuitem').allInnerTexts()
    assert(items.join('|') === 'Черновик|На согласовании', 'пункты меню: ' + items.join('|'))
    await page.getByRole('menuitem', { name: 'На согласовании' }).click()
    await snackbar(page, 'Статус изменён: На согласовании')
  })
  await step('Использование бюджета обновилось: заявка на согласовании резервирует 72 000 ₽', async () => {
    await page.goto(base + '/budgets')
    await page.getByTestId('budget-card').filter({ hasText: `E2E ${stamp}` }).getByText(/Зарезервировано: 72\s000/).waitFor()
    assert((await page.getByRole('button', { name: 'Новый бюджет' }).count()) === 0, 'сотрудник не управляет бюджетами')
  })
  await step('Выход: переход на вход, закрытые страницы недоступны', async () => {
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await page.waitForURL('**/login')
    await page.goto(base + '/trips')
    await page.waitForURL('**/login')
  })
  await ctx.close()
}

// ---------------------------------------------------------------- 2. руководитель
{
  const refreshResponses = []
  const { ctx, page } = await newPage()
  page.on('response', (r) => { if (r.url().endsWith('/auth/refresh')) refreshResponses.push(r.status()) })
  await step('Гость на закрытой странице → вход → возврат на неё', async () => {
    await page.goto(base + '/trips')
    await page.waitForURL('**/login')
    await page.getByLabel('Email').fill(users.manager.email)
    await page.getByLabel('Пароль').fill(users.manager.password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByTestId('user-menu').waitFor()
    assert(new URL(page.url()).pathname === '/trips', 'ожидали возврат на /trips')
  })
  await step('Поиск и фильтр по статусу выполняет сервер (параметры q и status в запросе)', async () => {
    const urls = []
    page.on('request', (r) => { if (r.url().startsWith(`${API}/trips?`)) urls.push(r.url()) })
    await page.getByLabel('Поиск').fill(stamp)
    await rows(page, 'trip-row', tripName).waitFor()
    await page.getByRole('button', { name: 'Согласована' }).click()
    await page.getByText('Ничего не найдено').waitFor()
    await page.getByRole('button', { name: 'На согласовании' }).click()
    await rows(page, 'trip-row', tripName).waitFor()
    assert(urls.some((u) => u.includes(`q=${stamp}`) && u.includes('status=pending')), 'фильтр не ушёл на сервер: ' + urls.at(-1))
    assert(await rows(page, 'trip-row', tripName).getByText(fresh.name).count() === 1, 'в списке нет имени сотрудника')
  })
  await step('Руководитель согласует командировку сотрудника', async () => {
    await rows(page, 'trip-row', tripName).click()
    await h1(page).filter({ hasText: tripName }).waitFor()
    await page.getByRole('button', { name: 'Изменить статус' }).click()
    assert((await page.getByRole('menuitem').count()) === 5, 'руководителю доступны все статусы')
    await page.getByRole('menuitem', { name: 'Согласована' }).click()
    await snackbar(page, 'Статус изменён: Согласована')
    await page.getByTestId('state-loading').waitFor({ state: 'detached' }).catch(() => undefined)
    const check = await api(await managerToken(), 'GET', `/trips/${tripId}`)
    assert(check.body.status === 'approved', 'статус на сервере: ' + check.body.status)
  })
  await step('Руководитель создаёт командировку за сотрудника (поле «Сотрудник»)', async () => {
    await page.goto(base + '/trips/new')
    await page.getByLabel('Направление').fill(`Поручение ${stamp}`)
    await page.getByLabel('Сотрудник').click()
    await page.getByRole('option', { name: users.employee.name }).click()
    await page.getByLabel('Дата начала').fill('2026-12-20')
    await page.getByLabel('Дата окончания').fill('2026-12-21')
    await page.getByLabel('Плановая сумма, ₽').fill('10000')
    await page.getByLabel('Бюджет').click()
    await page.getByRole('option', { name: new RegExp(`E2E ${stamp}`) }).click()
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await snackbar(page, 'Командировка создана')
    await page.getByText(users.employee.name).first().waitFor()
  })
  await step('Удалить бюджет с командировками нельзя: сообщение сервера (409)', async () => {
    await page.goto(base + '/budgets')
    const card = page.getByTestId('budget-card').filter({ hasText: `E2E ${stamp}` })
    await card.getByRole('button', { name: 'Удалить бюджет' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
    await snackbar(page, 'Нельзя удалить бюджет: к нему привязаны командировки')
  })
  await step('Бюджет: создание, изменение и удаление пустого бюджета', async () => {
    await page.getByRole('button', { name: 'Новый бюджет' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await page.getByText('Укажите: отдел').waitFor()
    await page.getByLabel('Отдел').fill(`Временный ${stamp}`)
    await page.getByLabel('Период').fill('2027-Q1')
    await page.getByLabel('Лимит, ₽').fill('1000')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Бюджет создан')
    const card = page.getByTestId('budget-card').filter({ hasText: `Временный ${stamp}` })
    await card.getByRole('button', { name: 'Изменить бюджет' }).click()
    await page.getByLabel('Лимит, ₽').fill('2500')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Бюджет сохранён')
    await card.getByText(/Лимит: 2\s500/).waitFor()
    await card.getByRole('button', { name: 'Удалить бюджет' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
    await snackbar(page, 'Бюджет удалён')
    await card.waitFor({ state: 'detached' })
  })
  await step('Страница «Сотрудники» с реальными данными', async () => {
    await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).click()
    await page.getByTestId('user-row').filter({ hasText: fresh.email }).waitFor()
  })
  if (tokenWait > 0) {
    await step('Истёкший access-токен обновляется тихо (нужен backend с ACCESS_TOKEN_EXPIRE_MINUTES=0.1)', async () => {
      const before = refreshResponses.length
      await page.waitForTimeout(tokenWait)
      await page.getByRole('navigation').getByText('Командировки', { exact: true }).click()
      await page.getByTestId('trip-row').first().waitFor()
      assert(new URL(page.url()).pathname === '/trips', 'произошёл редирект: ' + page.url())
      assert(refreshResponses.length > before && refreshResponses.at(-1) === 200, 'не было успешного обновления токена')
    })
  }
  await step('Состояние «загрузка» на медленном ответе сервера', async () => {
    await page.route(`${API}/budgets?*`, async (route) => { await new Promise((r) => setTimeout(r, 1500)); await route.continue() })
    await page.getByRole('navigation').getByText('Бюджеты', { exact: true }).click()
    await page.getByTestId('state-loading').waitFor({ timeout: 1400 })
    await page.getByTestId('budget-card').first().waitFor()
    await page.unroute(`${API}/budgets?*`)
  })
  await step('Нет связи с сервером: сообщение и «Повторить», после восстановления — данные', async () => {
    await page.route(`${API}/trips?*`, (route) => route.abort('failed'))
    await page.getByRole('navigation').getByText('Командировки', { exact: true }).click()
    await page.getByTestId('state-error').filter({ hasText: 'Нет связи с сервером' }).waitFor()
    await page.unroute(`${API}/trips?*`)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await page.getByTestId('trip-row').first().waitFor()
  })
  await step('Несуществующая командировка и неизвестный адрес — страница 404', async () => {
    await page.goto(base + '/trips/999999')
    await h1(page).filter({ hasText: '404' }).waitFor()
    await page.goto(base + '/zzz')
    await h1(page).filter({ hasText: '404' }).waitFor()
  })
  await ctx.close()
}

// ---------------------------------------------------------------- 3. права: сотрудник не видит чужого, бухгалтер
{
  const { ctx, page } = await newPage()
  await step('Другой сотрудник не видит чужую командировку: нет в списке, по адресу — 404', async () => {
    await loginUi(page, users.employee)
    await page.goto(base + '/trips')
    await page.getByLabel('Поиск').fill(tripName)
    await page.getByText('Ничего не найдено').waitFor()
    await page.goto(`${base}/trips/${tripId}`)
    await h1(page).filter({ hasText: '404' }).waitFor()
  })
  await step('Сотрудник: «Сотрудники» закрыты (403 — «Доступ запрещён» без «Повторить»), пункта меню нет', async () => {
    assert((await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).count()) === 0, 'пункт меню виден сотруднику')
    await page.goto(base + '/users')
    await page.getByTestId('state-error').filter({ hasText: 'Доступ запрещён' }).waitFor()
    await page.getByText('Недостаточно прав для этого действия').waitFor()
    assert((await page.getByRole('button', { name: 'Повторить' }).count()) === 0, 'при 403 повтор не нужен')
  })
  await step('Права проверяет backend: 404 на чужое, 403 на запрещённое, 401 без токена', async () => {
    const emp = await apiLogin(users.employee)
    assert((await api(emp.access, 'GET', `/trips/${tripId}`)).status === 404, 'чужая командировка')
    assert((await api(emp.access, 'POST', '/budgets', { department: 'X', period: 'Q', limit_amount: '1' })).status === 403, 'создание бюджета')
    assert((await api(emp.access, 'PATCH', `/trips/${tripId}`, { status: 'approved' })).status === 404, 'смена статуса чужой')
    assert((await fetch(`${API}/trips`)).status === 401, 'без токена')
  })
  await step('Сотрудник: ни один токен не хранится в localStorage/sessionStorage; refresh-cookie HttpOnly', async () => {
    const stored = await page.evaluate(() => JSON.stringify([Object.keys(localStorage), Object.keys(sessionStorage)]))
    assert(!/token/i.test(stored), 'токены в хранилище: ' + stored)
    const refresh = (await ctx.cookies()).find((c) => c.name === 'refresh_token')
    assert(refresh && refresh.httpOnly && refresh.path === '/auth', 'refresh-cookie должна быть HttpOnly и с Path=/auth')
  })
  await step('После выхода refresh-токен сессии больше не работает', async () => {
    const refresh = (await ctx.cookies()).find((c) => c.name === 'refresh_token')
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await page.waitForURL('**/login')
    const res = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { Cookie: `refresh_token=${refresh.value}` } })
    assert(res.status === 401, 'после выхода refresh должен давать 401, а дал ' + res.status)
  })
  await step('Бухгалтер: нет кнопок создания и изменения командировок и расходов, форма закрыта', async () => {
    await loginUi(page, users.accountant)
    await page.goto(`${base}/trips/${tripId}`)
    await h1(page).filter({ hasText: tripName }).waitFor()
    for (const name of ['Изменить статус', 'Изменить', 'Удалить командировку']) {
      assert((await page.getByRole('button', { name, exact: true }).count()) === 0, 'бухгалтеру видна кнопка ' + name)
    }
    await page.getByRole('tab', { name: /Расходы/ }).click()
    assert((await page.getByRole('button', { name: 'Добавить расход' }).count()) === 0, 'бухгалтер не добавляет расходы')
    await page.goto(base + '/trips/new')
    await page.getByText('Доступ запрещён').waitFor()
  })
  await step('Бухгалтер выдаёт аванс (смена статуса доступна только ему)', async () => {
    await page.goto(`${base}/trips/${tripId}`)
    await page.getByRole('button', { name: 'Статус' }).click()
    await page.getByRole('menuitem', { name: 'Выдан' }).click()
    await snackbar(page, 'Статус аванса: Выдан')
    await page.getByTestId('advance-item').filter({ hasText: 'Выдан' }).waitFor()
  })
  await ctx.close()
}

// ---------------------------------------------------------------- 4. мобильная ширина и reduced motion
{
  const { ctx, page } = await newPage({ width: 390, height: 800 })
  await loginUi(page, users.manager)
  await step('Мобильная версия: меню-«бургер», без горизонтальной прокрутки', async () => {
    await page.getByRole('button', { name: 'Открыть меню' }).click()
    await page.getByRole('navigation').getByText('Бюджеты', { exact: true }).click()
    await h1(page).filter({ hasText: 'Бюджеты' }).waitFor()
    for (const url of ['/trips', `/trips/${tripId}`, '/advances', '/expenses', '/budgets', '/trips/new', '/users']) {
      await page.goto(base + url)
      await h1(page).waitFor()
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      assert(!overflow, 'горизонтальная прокрутка на ' + url)
    }
  })
  await ctx.close()
}
{
  const { ctx, page } = await newPage({ width: 1366, height: 800 }, { reducedMotion: 'reduce' })
  await loginUi(page, users.manager)
  await step('prefers-reduced-motion: переходы отключаются', async () => {
    await page.goto(base + '/trips')
    await page.getByTestId('trip-row').first().waitFor()
    const dur = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('button')).transitionDuration))
    assert(dur <= 0.001, 'длительность перехода: ' + dur)
  })
  await ctx.close()
}

// ---------------------------------------------------------------- уборка: удаляем данные прогона
{
  const fr = await apiLogin(fresh)
  await api(fr.access, 'DELETE', `/trips/${tripId}`)
  const own = await api(await managerToken(), 'GET', `/trips?budget_id=${budget.id}&limit=500`)
  for (const t of own.body) await api(await managerToken(), 'DELETE', `/trips/${t.id}`)
  await api(await managerToken(), 'DELETE', `/budgets/${budget.id}`)
}

await step('Ошибок в консоли браузера нет', async () => {
  assert(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
})

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} шагов успешно`)
process.exit(failed.length ? 1 : 0)
