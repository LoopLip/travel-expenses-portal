// Сценарная проверка интерфейса в браузере (Playwright + установленный Chrome).
// Требуется: PostgreSQL, backend (лучше с ACCESS_TOKEN_EXPIRE_MINUTES=0.1, тогда проверяется истечение токена) и `npm run dev`.
// Запуск: `npm run e2e`. Переменные: BASE_URL (http://127.0.0.1:5173), API_URL (http://127.0.0.1:8000), CHROME_PATH,
// SHOTS=1 — сохранить скриншоты. Экраны данных работают на демо-хранилище, вход и права — на реальном backend.
import { chromium } from 'playwright-core'
import { ensureBackend, loginUi as loginUiRaw, provisionUsers } from './e2e-env.mjs'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const shotsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots')
const takeShots = process.env.SHOTS === '1'
if (takeShots) mkdirSync(shotsDir, { recursive: true })

const results = []
let consoleErrors = []

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
const browser = await chromium.launch({ executablePath: chromePath })
const loginUi = (page, user) => loginUiRaw(page, base, user)
// Браузер пишет в консоль «Failed to load resource ... 401/403/409» при ожидаемых отказах (неверный пароль, гость, чужие данные):
// это нормальные ответы backend, а не ошибки приложения.
const EXPECTED_HTTP = /Failed to load resource: the server responded with a status of (401|403|409)/

async function newPage(viewport = { width: 1366, height: 800 }, options = {}) {
  const ctx = await browser.newContext({ viewport, ...options })
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error' && !EXPECTED_HTTP.test(m.text())) consoleErrors.push(m.text()) })
  return { ctx, page }
}
const shot = async (page, name, fullPage = true) => { if (takeShots) await page.screenshot({ path: path.join(shotsDir, name), fullPage }) }
const snackbar = (page, text) => page.getByTestId('snackbar').filter({ hasText: text }).waitFor()
const h1 = (page) => page.locator('h1').first()

// ---------------------------------------------------------------- 1. экраны и навигация (десктоп)
{
  const { ctx, page } = await newPage()
  await loginUi(page, users.manager)
  await step('Открываются все экраны', async () => {
    const screens = [['/', 'Обзор'], ['/trips', 'Командировки'], ['/trips/1', 'Санкт-Петербург'], ['/trips/new', 'Новая заявка на командировку'],
      ['/trips/1/edit', 'Редактирование командировки'], ['/expenses', 'Расходы'], ['/expenses/new', 'Новый расход'], ['/advances', 'Авансы'], ['/budgets', 'Бюджеты']]
    for (const [url, title] of screens) {
      await page.goto(base + url)
      await h1(page).filter({ hasText: title }).waitFor()
    }
  })
  await step('Переходы через меню сохранены (ЛР №1)', async () => {
    await page.goto(base + '/')
    for (const [label, title] of [['Командировки', 'Командировки'], ['Расходы', 'Расходы'], ['Авансы', 'Авансы'], ['Бюджеты', 'Бюджеты'], ['Обзор', 'Обзор']]) {
      await page.getByRole('navigation').getByText(label, { exact: true }).click()
      await h1(page).filter({ hasText: title }).waitFor()
    }
  })
  await step('Страница 404 для неизвестного адреса и несуществующей командировки', async () => {
    await page.goto(base + '/zzz')
    await h1(page).filter({ hasText: '404' }).waitFor()
    await page.goto(base + '/trips/999')
    await h1(page).filter({ hasText: '404' }).waitFor()
  })

  // ------------------------------------------------------------ 2. список: фильтр и поиск
  await step('Список командировок: фильтр по статусу и поиск', async () => {
    await page.goto(base + '/trips')
    await page.getByTestId('trip-row').first().waitFor()
    assert((await page.getByTestId('trip-row').count()) === 5, 'ожидали 5 строк')
    await page.getByRole('button', { name: 'На согласовании' }).click()
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="trip-row"]').length === 1)
    await page.getByRole('button', { name: 'Все', exact: true }).click()
    await page.getByLabel('Поиск').fill('казань')
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="trip-row"]').length === 1)
    await page.getByLabel('Поиск').fill('zzzz')
    await page.getByTestId('state-empty').waitFor()
    await shot(page, 'state-empty-search-desktop.png')
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="trip-row"]').length === 5)
  })

  // ------------------------------------------------------------ 3. форма командировки: ошибки валидации и создание
  await step('Форма командировки: ошибки валидации на русском возле полей', async () => {
    await page.goto(base + '/trips/new')
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    for (const text of ['Укажите: направление', 'Выберите: сотрудник', 'Выберите: бюджет', 'Укажите дату', 'Укажите сумму']) {
      await page.getByText(text).first().waitFor()
    }
    await page.getByLabel('Направление').fill('Тестоград')
    await page.getByLabel('Дата начала').fill('2026-12-10')
    await page.getByLabel('Дата окончания').fill('2026-12-01')
    await page.getByLabel('Плановая сумма, ₽').fill('10.123')
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await page.getByText('Дата окончания не может быть раньше даты начала').waitFor()
    await page.getByText('не более чем с 2 знаками').waitFor()
    assert(await page.getByLabel('Направление').getAttribute('aria-invalid') !== 'true', 'направление валидно, ошибки быть не должно')
    await shot(page, 'form-validation-desktop.png')
  })
  let newTripUrl = ''
  await step('Создание командировки: блокировка кнопки, уведомление, переход в карточку', async () => {
    await page.getByLabel('Дата окончания').fill('2026-12-12')
    await page.getByLabel('Плановая сумма, ₽').fill('72000')
    await page.getByLabel('Сотрудник').click()
    await page.getByRole('option', { name: 'Петрова Анна' }).click()
    await page.getByLabel('Бюджет').click()
    await page.getByRole('option', { name: /Разработка/ }).click()
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await page.getByRole('button', { name: 'Сохраняем…' }).waitFor() // кнопка заблокирована на время отправки
    assert(await page.getByRole('button', { name: 'Сохраняем…' }).isDisabled(), 'кнопка должна быть заблокирована')
    await snackbar(page, 'Командировка создана')
    await h1(page).filter({ hasText: 'Тестоград' }).waitFor()
    newTripUrl = page.url()
    await shot(page, 'trip-created-snackbar-desktop.png', false)
  })

  // ------------------------------------------------------------ 4. аванс сверх лимита
  await step('Аванс сверх лимита: ошибка валидации, затем успех в пределах лимита', async () => {
    await page.getByRole('button', { name: 'Запросить аванс' }).click()
    await page.getByLabel('Сумма аванса, ₽').fill('80000')
    await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
    await page.getByText(/превышает плановую сумму командировки/).waitFor()
    await shot(page, 'advance-limit-error-desktop.png', false)
    await page.getByLabel('Сумма аванса, ₽').fill('40000')
    await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
    await snackbar(page, 'Аванс запрошен')
    await page.getByTestId('advance-item').first().waitFor()
    // повторный аванс 40000 превысит план 72000
    await page.getByRole('button', { name: 'Запросить аванс' }).click()
    await page.getByLabel('Сумма аванса, ₽').fill('40000')
    await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
    await page.getByText(/превышает плановую сумму командировки/).waitFor()
    await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()
    assert((await page.getByTestId('advance-item').count()) === 1, 'должен остаться один аванс')
  })

  // ------------------------------------------------------------ 5. расход
  await step('Добавление расхода из карточки: валидация и успех', async () => {
    await page.getByRole('tab', { name: /Расходы/ }).click()
    await page.getByRole('button', { name: 'Добавить расход' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await page.getByText('Укажите: описание').waitFor()
    await page.getByLabel('Описание').fill('Такси')
    await page.getByLabel('Сумма, ₽').fill('0')
    await page.getByLabel('Дата').fill('2026-12-02')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await page.getByText('Сумма должна быть больше нуля').waitFor()
    await shot(page, 'expense-dialog-validation-desktop.png', false)
    await page.getByLabel('Сумма, ₽').fill('1200,50')
    await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
    await snackbar(page, 'Расход добавлен')
    await page.getByTestId('expense-item').filter({ hasText: 'Такси' }).waitFor()
  })
  await step('Удаление расхода: отмена не удаляет, подтверждение удаляет', async () => {
    await page.getByRole('button', { name: 'Удалить расход' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    assert((await page.getByTestId('expense-item').count()) === 1, 'после отмены расход должен остаться')
    await page.getByRole('button', { name: 'Удалить расход' }).click()
    await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(600) // дождаться завершения анимации диалога
    await shot(page, 'confirm-dialog-desktop.png', false)
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
    await snackbar(page, 'Расход удалён')
    await page.getByText('Расходов пока нет').waitFor()
  })
  await step('Смена статуса командировки', async () => {
    await page.getByRole('button', { name: 'Изменить статус' }).click()
    await page.getByRole('menuitem', { name: 'Согласована' }).click()
    await snackbar(page, 'Статус изменён: Согласована')
  })
  await step('Редактирование командировки', async () => {
    await page.goto(newTripUrl + '/edit')
    await page.getByLabel('Направление').waitFor()
    await page.getByLabel('Направление').fill('Тестоград-2')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await snackbar(page, 'Командировка сохранена')
    await h1(page).filter({ hasText: 'Тестоград-2' }).waitFor()
  })
  await step('Редактирование: плановую сумму нельзя снизить ниже авансов (ошибка сервера)', async () => {
    await page.goto(newTripUrl + '/edit')
    await page.getByLabel('Плановая сумма, ₽').fill('1000')
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await page.getByTestId('form-server-error').filter({ hasText: 'Плановая сумма не может быть меньше суммы авансов' }).waitFor()
  })
  await step('Расход с «фото чека»: предзаполнение суммы и даты', async () => {
    await page.goto(base + '/expenses/new')
    await page.getByLabel('Сумма, ₽').waitFor()
    await page.setInputFiles('input[type=file]', { name: 'check.png', mimeType: 'image/png', buffer: Buffer.from('x') })
    await page.waitForFunction(() => document.querySelector('#amount')?.value === '3450')
    assert((await page.getByLabel('Дата').inputValue()) === '2026-10-12', 'дата не подставилась')
  })
  await step('Расходы: фильтр по категории и поиск', async () => {
    await page.goto(base + '/expenses')
    await page.getByTestId('expense-row').first().waitFor()
    await page.getByLabel('Категория').click()
    await page.getByRole('option', { name: 'Питание' }).click()
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="expense-row"]').length === 1)
  })
  await step('Авансы: фильтр по статусу (руководитель не видит смену статуса)', async () => {
    await page.goto(base + '/advances')
    await page.getByTestId('advance-row').first().waitFor()
    await page.getByRole('button', { name: 'Запрошен', exact: true }).click()
    // ждём окончания анимации исчезновения лишних строк
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="advance-row"]')].every((r) => r.textContent.includes('Запрошен')) && document.querySelectorAll('[data-testid="advance-row"]').length >= 1 && document.querySelectorAll('[data-testid="advance-row"]').length <= 2)
    assert((await page.getByRole('button', { name: 'Статус' }).count()) === 0, 'руководителю не нужна кнопка смены статуса аванса')
  })
  await step('Удаление командировки из списка с подтверждением (каскад)', async () => {
    await page.goto(base + '/trips')
    const row = page.getByTestId('trip-row').filter({ hasText: 'Тестоград-2' })
    await row.waitFor()
    await row.getByRole('button', { name: 'Удалить командировку' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
    await snackbar(page, 'Командировка удалена')
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="trip-row"]')].some((r) => r.textContent.includes('Тестоград-2')))
  })

  // ------------------------------------------------------------ 6. состояния загрузка / ошибка / пусто
  await step('Состояние «загрузка» (медленная сеть)', async () => {
    await page.goto(base + '/budgets')
    await page.getByTestId('budget-card').first().waitFor()
    await page.getByLabel('Медленная сеть').check()
    await page.getByRole('navigation').getByText('Расходы', { exact: true }).click()
    await page.getByTestId('state-loading').waitFor({ timeout: 2000 })
    await shot(page, 'state-loading-desktop.png', false)
    await page.getByLabel('Медленная сеть').uncheck()
    await page.getByTestId('expense-row').first().waitFor({ timeout: 6000 })
  })
  await step('Состояние «ошибка» и кнопка «Повторить»', async () => {
    await page.getByLabel('Имитировать ошибку').check()
    await page.getByRole('navigation').getByText('Командировки', { exact: true }).click()
    await page.getByTestId('state-error').waitFor()
    await shot(page, 'state-error-desktop.png', false)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await page.getByTestId('state-error').waitFor() // пока ошибка включена — остаётся
    await page.getByLabel('Имитировать ошибку').uncheck()
    await page.getByRole('button', { name: 'Повторить' }).click().catch(() => undefined)
    await page.getByTestId('trip-row').first().waitFor()
  })
  await step('Состояние «нет данных» и восстановление демо-данных', async () => {
    await page.getByRole('button', { name: 'Очистить данные' }).click()
    await page.getByTestId('state-empty').waitFor()
    await page.getByText('Командировок пока нет').waitFor()
    await shot(page, 'state-empty-desktop.png', false)
    await page.getByRole('button', { name: 'Сбросить данные' }).click()
    await page.getByTestId('trip-row').first().waitFor()
  })
  await ctx.close()
}

// ---------------------------------------------------------------- 7. мобильная ширина
{
  const { ctx, page } = await newPage({ width: 390, height: 800 })
  await loginUi(page, users.manager)
  await step('Мобильная версия: меню-«бургер» и отсутствие горизонтальной прокрутки', async () => {
    await page.goto(base + '/')
    await page.getByRole('button', { name: 'Открыть меню' }).click()
    await page.getByRole('navigation').getByText('Бюджеты', { exact: true }).click()
    await h1(page).filter({ hasText: 'Бюджеты' }).waitFor()
    for (const url of ['/trips', '/trips/1', '/advances', '/expenses', '/budgets', '/trips/new']) {
      await page.goto(base + url)
      await h1(page).waitFor()
      await page.waitForTimeout(400)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      assert(!overflow, 'горизонтальная прокрутка на ' + url)
    }
    await page.goto(base + '/trips/new')
    await page.getByRole('button', { name: 'Создать командировку' }).click()
    await page.getByText('Укажите: направление').waitFor()
    await shot(page, 'form-validation-mobile.png')
  })
  await ctx.close()
}

// ---------------------------------------------------------------- 8. reduced motion
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

// ---------------------------------------------------------------- 9. аутентификация и права (реальный backend)
{
  const refreshResponses = []
  const { ctx, page } = await newPage()
  page.on('response', (r) => { if (r.url().endsWith('/auth/refresh')) refreshResponses.push(r.status()) })
  const userMenu = (p) => p.getByTestId('user-menu')
  const fresh = { name: 'Новый Тестовый', email: `e2e-${Date.now().toString(36)}-new@example.com`, password: 'Pw-new-' + Math.random().toString(36).slice(2, 12) }

  await step('Гость на закрытой странице отправляется на /login, после входа возвращается на неё', async () => {
    await page.goto(base + '/trips')
    await page.waitForURL('**/login')
    await page.getByRole('heading', { name: 'Вход' }).waitFor()
    await shot(page, 'login-desktop.png', false)
    await page.getByLabel('Email').fill(users.manager.email)
    await page.getByLabel('Пароль').fill(users.manager.password)
    await page.getByRole('button', { name: 'Войти' }).click()
    await userMenu(page).waitFor()
    assert(new URL(page.url()).pathname === '/trips', 'ожидали возврат на /trips, а адрес ' + page.url())
    await h1(page).filter({ hasText: 'Командировки' }).waitFor()
  })
  await step('Меню пользователя: имя и роль; перезагрузка страницы сохраняет сессию', async () => {
    await page.goto(base + '/budgets')
    await userMenu(page).waitFor()
    await userMenu(page).click()
    assert((await page.getByTestId('user-role').innerText()) === 'Руководитель', 'роль в меню')
    await shot(page, 'user-menu-desktop.png', false)
    await page.keyboard.press('Escape')
    await page.reload()
    await userMenu(page).waitFor()
    assert(new URL(page.url()).pathname === '/budgets', 'после перезагрузки адрес изменился')
    await h1(page).filter({ hasText: 'Бюджеты' }).waitFor()
  })
  await step('Руководитель видит страницу «Сотрудники» с реальными данными', async () => {
    await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).click()
    await page.getByTestId('user-row').first().waitFor()
    assert((await page.getByTestId('user-row').count()) >= 3, 'ожидали минимум трёх пользователей')
    await shot(page, 'users-desktop.png', false)
  })
  await step('Истёкший access-токен обновляется автоматически, пользователь ничего не замечает', async () => {
    await page.getByRole('navigation').getByText('Бюджеты', { exact: true }).click()
    await h1(page).filter({ hasText: 'Бюджеты' }).waitFor()
    const before = refreshResponses.length
    await page.waitForTimeout(Number(process.env.TOKEN_WAIT_MS ?? 8000)) // срок access-токена при ACCESS_TOKEN_EXPIRE_MINUTES=0.1 — 6 с
    await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).click()
    await page.getByTestId('user-row').first().waitFor()
    assert(new URL(page.url()).pathname === '/users', 'произошёл редирект: ' + page.url())
    assert(refreshResponses.length > before && refreshResponses.at(-1) === 200, 'не было успешного обновления токена (проверьте ACCESS_TOKEN_EXPIRE_MINUTES=0.1)')
  })
  await step('Выход: переход на /login, закрытые страницы снова недоступны', async () => {
    await userMenu(page).click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await page.waitForURL('**/login')
    await page.goto(base + '/trips')
    await page.waitForURL('**/login')
  })
  await step('Ошибки входа: пустая форма и неверный пароль', async () => {
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByText('Укажите email').waitFor()
    await page.getByText('Введите пароль').waitFor()
    await page.getByLabel('Email').fill(users.manager.email)
    await page.getByLabel('Пароль').fill('неверный-пароль')
    await page.getByRole('button', { name: 'Войти' }).click()
    await page.getByTestId('form-server-error').filter({ hasText: 'Неверный email или пароль' }).waitFor()
    await shot(page, 'login-error-desktop.png', false)
    assert(new URL(page.url()).pathname === '/login', 'остаёмся на /login')
  })
  await step('Регистрация: ошибки валидации, затем успех и автоматический вход', async () => {
    await page.getByRole('link', { name: 'Зарегистрироваться' }).click()
    await page.getByRole('heading', { name: 'Регистрация' }).waitFor()
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.getByText('Укажите: имя и фамилия').waitFor()
    await page.getByLabel('Email').fill(fresh.email)
    await page.getByLabel('Имя и фамилия').fill(fresh.name)
    await page.getByLabel('Пароль', { exact: true }).fill('short')
    await page.getByLabel('Повторите пароль').fill('short')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.getByText('Пароль: не короче 8 символов').waitFor()
    await page.getByLabel('Пароль', { exact: true }).fill(fresh.password)
    await page.getByLabel('Повторите пароль').fill('другой-пароль')
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.getByText('Пароли не совпадают').waitFor()
    await shot(page, 'register-errors-desktop.png')
    await page.getByLabel('Пароль', { exact: true }).fill(fresh.password)
    await page.getByLabel('Повторите пароль').fill(fresh.password)
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await userMenu(page).waitFor()
    await userMenu(page).click()
    assert((await page.getByTestId('user-role').innerText()) === 'Сотрудник', 'новый пользователь — сотрудник')
    await page.keyboard.press('Escape')
  })
  await step('Повторная регистрация того же email: понятная ошибка', async () => {
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await page.waitForURL('**/login')
    await page.goto(base + '/register')
    await page.getByLabel('Имя и фамилия').fill(fresh.name)
    await page.getByLabel('Email').fill(fresh.email)
    await page.getByLabel('Пароль', { exact: true }).fill(fresh.password)
    await page.getByLabel('Повторите пароль').fill(fresh.password)
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
    await page.getByTestId('form-server-error').filter({ hasText: 'уже существует' }).waitFor()
  })
  await step('Сотрудник: страница «Сотрудники» закрыта (403), пункта меню нет, статусы командировок не меняет', async () => {
    await loginUi(page, users.employee)
    assert((await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).count()) === 0, 'пункт меню виден сотруднику')
    await page.goto(base + '/users')
    await page.getByTestId('state-error').filter({ hasText: 'Доступ запрещён' }).waitFor()
    await page.getByText('Недостаточно прав для этого действия').waitFor()
    assert((await page.getByRole('button', { name: 'Повторить' }).count()) === 0, 'при 403 повтор не нужен')
    await shot(page, 'forbidden-desktop.png', false)
    await page.goto(base + '/trips/1')
    await h1(page).filter({ hasText: 'Санкт-Петербург' }).waitFor()
    assert((await page.getByRole('button', { name: 'Изменить статус' }).count()) === 0, 'сотрудник видит смену статуса')
  })
  await step('Права проверяются на backend: чужая командировка недоступна сотруднику (404), 403 на запрещённое', async () => {
    const { apiLogin, API } = await import('./e2e-env.mjs')
    const mgr = await apiLogin(users.manager)
    const emp = await apiLogin(users.employee)
    const budget = await (await fetch(`${API}/budgets`, { method: 'POST', headers: { Authorization: `Bearer ${mgr.access}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ department: 'E2E', period: 'Q', limit_amount: '1000' }) })).json()
    const me = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${mgr.access}` } })).json()
    const trip = await (await fetch(`${API}/trips`, { method: 'POST', headers: { Authorization: `Bearer ${mgr.access}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ destination: 'Чужая', start_date: '2026-12-01', end_date: '2026-12-02', budget_id: budget.id, user_id: me.id }) })).json()
    const foreign = await fetch(`${API}/trips/${trip.id}`, { headers: { Authorization: `Bearer ${emp.access}` } })
    assert(foreign.status === 404, 'ожидали 404, получили ' + foreign.status)
    const denied = await fetch(`${API}/budgets`, { method: 'POST', headers: { Authorization: `Bearer ${emp.access}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ department: 'X', period: 'Q', limit_amount: '1' }) })
    assert(denied.status === 403, 'ожидали 403, получили ' + denied.status)
    const anon = await fetch(`${API}/trips`)
    assert(anon.status === 401, 'без токена ожидали 401, получили ' + anon.status)
  })
  await step('После выхода refresh-токен сессии больше не работает', async () => {
    const { API } = await import('./e2e-env.mjs')
    const cookies = await ctx.cookies()
    const refresh = cookies.find((c) => c.name === 'refresh_token')
    assert(refresh && refresh.httpOnly && refresh.path === '/auth', 'refresh-cookie должна быть HttpOnly и с Path=/auth')
    const stored = await page.evaluate(() => JSON.stringify([Object.keys(localStorage), Object.keys(sessionStorage)]))
    assert(!/token/i.test(stored.replace(/demo:/g, '')), 'токены не должны лежать в localStorage/sessionStorage: ' + stored)
    await page.getByTestId('user-menu').click()
    await page.getByRole('menuitem', { name: 'Выйти' }).click()
    await page.waitForURL('**/login')
    const res = await fetch(`${API}/auth/refresh`, { method: 'POST', headers: { Cookie: `refresh_token=${refresh.value}` } })
    assert(res.status === 401, 'после выхода refresh должен давать 401, а дал ' + res.status)
  })
  await ctx.close()
}
{
  const { ctx, page } = await newPage()
  await step('Бухгалтер выдаёт аванс: смена статуса доступна только ему', async () => {
    await loginUi(page, users.accountant)
    await page.goto(base + '/advances')
    await page.getByTestId('advance-row').first().waitFor()
    await page.getByRole('button', { name: 'Запрошен', exact: true }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="advance-row"]')].every((r) => r.textContent.includes('Запрошен')) && document.querySelectorAll('[data-testid="advance-row"]').length >= 1)
    await page.getByRole('button', { name: 'Статус' }).first().click()
    await page.getByRole('menuitem', { name: 'Выдан' }).click()
    await snackbar(page, 'Статус аванса: Выдан')
  })
  await ctx.close()
}
await step('Ошибок в консоли браузера нет', async () => {
  assert(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
})

await browser.close()
const failed = results.filter((r) => !r.ok)
console.log(`\nИтого: ${results.length - failed.length} из ${results.length} сценариев пройдено`)
process.exit(failed.length ? 1 : 0)
