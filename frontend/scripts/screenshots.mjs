// Скриншоты всех экранов на демо-данных из PostgreSQL (docs/screenshots).
// Требуется: БД с данными `python -m app.cli seed-demo`, backend и `npm run dev`.
// Запуск (PowerShell): $env:DEMO_PASSWORD = "<пароль демо-пользователей>"; npm run screenshots
// Пароль берётся из переменной окружения и нигде не сохраняется; в кадр поля пароля попадают только точками.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { API, ensureBackend } from './e2e-env.mjs'

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const password = process.env.DEMO_PASSWORD
if (!password) throw new Error('Задайте DEMO_PASSWORD — пароль демо-пользователей из seed-demo')
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots')
mkdirSync(dir, { recursive: true })

const demo = {
  manager: { email: 'manager@example.com', password },
  accountant: { email: 'accountant@example.com', password },
  employee: { email: 'ivanov@example.com', password },
}

await ensureBackend()
const browser = await chromium.launch({ executablePath: chromePath })
const DESKTOP = { width: 1366, height: 800 }
const MOBILE = { width: 390, height: 844 }

async function open(viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' }) // без анимаций кадры стабильны
  const page = await ctx.newPage()
  page.setDefaultTimeout(10000)
  return { ctx, page }
}
async function login(page, user) {
  await page.goto(base + '/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByTestId('user-menu').waitFor()
}
const shot = async (page, name, fullPage = true) => {
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(dir, name), fullPage })
  console.log('saved', name)
}
const h1 = (page, text) => page.locator('h1').filter({ hasText: text }).waitFor()
const tripId = async (page, destination) => {
  await page.goto(base + '/trips')
  await page.getByTestId('trip-row').filter({ hasText: destination }).click()
  await h1(page, destination)
  return new URL(page.url()).pathname.split('/').pop()
}

// ---------- гость: вход и регистрация ----------
for (const [viewport, suffix] of [[DESKTOP, 'desktop'], [MOBILE, 'mobile']]) {
  const { ctx, page } = await open(viewport)
  await page.goto(base + '/login')
  await page.getByRole('heading', { name: 'Вход' }).waitFor()
  await shot(page, `login-${suffix}.png`)
  await page.goto(base + '/register')
  await page.getByRole('heading', { name: 'Регистрация' }).waitFor()
  await shot(page, `register-${suffix}.png`)
  await ctx.close()
}
{
  const { ctx, page } = await open()
  await page.goto(base + '/login')
  await page.getByLabel('Email').fill('ivanov@example.com')
  await page.getByLabel('Пароль').fill('неверный-пароль')
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByTestId('form-server-error').waitFor()
  await shot(page, 'login-error-desktop.png')
  await page.goto(base + '/register')
  await page.getByLabel('Email').fill('ivanov@example.com')
  await page.getByLabel('Имя и фамилия').fill('Иванов Иван')
  await page.getByLabel('Пароль', { exact: true }).fill('short')
  await page.getByLabel('Повторите пароль').fill('другой')
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click()
  await page.getByText('Пароль: не короче 8 символов').waitFor()
  await shot(page, 'register-errors-desktop.png')
  await ctx.close()
}

// ---------- руководитель ----------
{
  const { ctx, page } = await open()
  await login(page, demo.manager)
  await page.goto(base + '/')
  await page.getByText('Использование бюджетов').waitFor()
  await page.getByText('Ближайшие командировки').waitFor()
  await shot(page, 'dashboard-desktop.png')
  await page.getByTestId('user-menu').click()
  await page.getByTestId('user-role').waitFor()
  await shot(page, 'user-menu-desktop.png', false)
  await page.keyboard.press('Escape')

  await page.goto(base + '/trips')
  await page.getByTestId('trip-row').first().waitFor()
  await shot(page, 'trips-desktop.png')
  await page.getByRole('button', { name: 'На согласовании' }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="trip-row"]')].every((r) => r.textContent.includes('На согласовании')))
  await shot(page, 'trips-filter-desktop.png')
  await page.getByRole('button', { name: 'Все', exact: true }).click()
  await page.getByLabel('Поиск').fill('Владивосток')
  await page.getByText('Ничего не найдено').waitFor()
  await shot(page, 'state-empty-search-desktop.png')

  const kazan = await tripId(page, 'Казань')
  await page.getByRole('button', { name: 'Подробнее' }).click()
  await page.getByText('Цель:').waitFor()
  await shot(page, 'trip-details-desktop.png')
  await page.getByRole('tab', { name: /Расходы/ }).click()
  await page.getByTestId('expense-item').first().waitFor()
  await shot(page, 'trip-details-expenses-desktop.png')
  await page.getByRole('tab', { name: 'Сводка' }).click()
  await shot(page, 'trip-details-summary-desktop.png')
  await page.getByRole('button', { name: 'Изменить статус' }).click()
  await page.getByRole('menuitem').first().waitFor()
  await shot(page, 'trip-status-menu-desktop.png', false)
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: /Авансы/ }).click()
  await page.getByRole('button', { name: 'Запросить аванс' }).click()
  await page.getByLabel('Сумма аванса, ₽').fill('50000')
  await page.getByRole('dialog').getByRole('button', { name: 'Запросить', exact: true }).click()
  await page.getByText(/превышает плановую сумму/).waitFor()
  await shot(page, 'advance-limit-error-desktop.png', false)
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: 'Удалить командировку' }).click()
  await page.getByRole('dialog').waitFor()
  await shot(page, 'confirm-dialog-desktop.png', false)
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()

  await page.goto(`${base}/trips/${kazan}/edit`)
  await page.getByLabel('Направление').waitFor()
  await shot(page, 'trip-edit-desktop.png')
  await page.getByLabel('Плановая сумма, ₽').fill('1000')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await page.getByTestId('form-server-error').waitFor()
  await shot(page, 'form-server-error-desktop.png')

  await page.goto(base + '/trips/new')
  await page.getByLabel('Сотрудник').waitFor()
  await shot(page, 'trip-new-desktop.png')
  await page.getByLabel('Плановая сумма, ₽').fill('10.123')
  await page.getByLabel('Дата начала').fill('2026-12-10')
  await page.getByLabel('Дата окончания').fill('2026-12-01')
  await page.getByRole('button', { name: 'Создать командировку' }).click()
  await page.getByText('Укажите: направление').waitFor()
  await shot(page, 'form-validation-desktop.png')

  await page.goto(base + '/expenses')
  await page.getByTestId('expense-row').first().waitFor()
  await shot(page, 'expenses-desktop.png')
  await page.getByRole('button', { name: 'Изменить расход' }).first().click()
  await page.getByLabel('Описание').waitFor()
  await shot(page, 'expense-edit-desktop.png', false)
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()

  await page.goto(base + '/budgets')
  await page.getByTestId('budget-card').first().waitFor()
  await shot(page, 'budgets-desktop.png')
  await page.getByRole('button', { name: 'Новый бюджет' }).click()
  await page.getByLabel('Отдел').waitFor()
  await shot(page, 'budget-dialog-desktop.png', false)
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена' }).click()

  await page.goto(base + '/users')
  await page.getByTestId('user-row').first().waitFor()
  await shot(page, 'users-desktop.png')

  await page.route(`${API}/trips?*`, async (route) => { await new Promise((r) => setTimeout(r, 4000)); await route.continue() })
  await page.goto(base + '/trips')
  await page.getByTestId('state-loading').waitFor()
  await shot(page, 'state-loading-desktop.png', false)
  await page.unroute(`${API}/trips?*`)
  await page.route(`${API}/trips?*`, (route) => route.abort('failed'))
  await page.goto(base + '/trips')
  await page.getByTestId('state-error').waitFor()
  await shot(page, 'state-error-desktop.png', false)
  await page.unroute(`${API}/trips?*`)

  await page.goto(base + '/trips/999999')
  await h1(page, '404')
  await shot(page, 'not-found-desktop.png', false)
  await ctx.close()
}

// ---------- руководитель, мобильная ширина ----------
{
  const { ctx, page } = await open(MOBILE)
  await login(page, demo.manager)
  await page.getByText('Использование бюджетов').waitFor()
  await shot(page, 'dashboard-mobile.png')
  await page.goto(base + '/trips')
  await page.getByTestId('trip-row').first().waitFor()
  await shot(page, 'trips-mobile.png')
  await tripId(page, 'Казань')
  await shot(page, 'trip-details-mobile.png')
  await page.goto(base + '/trips/new')
  await page.getByLabel('Направление').waitFor()
  await shot(page, 'trip-new-mobile.png')
  await page.goto(base + '/budgets')
  await page.getByTestId('budget-card').first().waitFor()
  await shot(page, 'budgets-mobile.png')
  await page.getByRole('button', { name: 'Открыть меню' }).click()
  await page.getByRole('navigation').getByText('Сотрудники', { exact: true }).waitFor()
  await shot(page, 'menu-mobile.png', false)
  await ctx.close()
}

// ---------- сотрудник ----------
{
  const { ctx, page } = await open()
  await login(page, demo.employee)
  await page.goto(base + '/trips')
  await page.getByTestId('trip-row').first().waitFor()
  await shot(page, 'trips-employee-desktop.png')
  await page.goto(base + '/trips/new')
  await page.getByLabel('Направление').waitFor()
  await shot(page, 'trip-new-employee-desktop.png')
  await tripId(page, 'Екатеринбург')
  await page.getByRole('button', { name: 'Изменить статус' }).click()
  await page.getByRole('menuitem').first().waitFor()
  await shot(page, 'trip-status-employee-desktop.png', false)
  await page.keyboard.press('Escape')
  await page.goto(base + '/budgets')
  await page.getByTestId('budget-card').first().waitFor()
  await shot(page, 'budgets-employee-desktop.png')
  await page.goto(base + '/users')
  await page.getByText('Доступ запрещён').waitFor()
  await shot(page, 'forbidden-desktop.png', false)
  await page.goto(base + '/expenses')
  await page.getByLabel('Категория').click()
  await page.getByRole('option', { name: 'Питание' }).click()
  await page.getByText('Ничего не найдено').waitFor()
  await shot(page, 'state-empty-desktop.png', false)
  await ctx.close()
}

// ---------- бухгалтер ----------
{
  const { ctx, page } = await open()
  await login(page, demo.accountant)
  await page.goto(base + '/advances')
  await page.getByTestId('advance-row').first().waitFor()
  await shot(page, 'advances-desktop.png')
  await page.getByRole('button', { name: 'Статус' }).first().click()
  await page.getByRole('menuitem').first().waitFor()
  await shot(page, 'advance-status-accountant-desktop.png', false)
  await page.keyboard.press('Escape')
  await tripId(page, 'Санкт-Петербург')
  await page.getByRole('tab', { name: /Расходы/ }).click()
  await page.getByTestId('expense-item').first().waitFor()
  await shot(page, 'trip-details-accountant-desktop.png')
  await page.goto(base + '/advances')
  await page.getByTestId('advance-row').first().waitFor()
  await ctx.close()
  const m = await open(MOBILE)
  await login(m.page, demo.accountant)
  await m.page.goto(base + '/advances')
  await m.page.getByTestId('advance-row').first().waitFor()
  await shot(m.page, 'advances-mobile.png')
  await m.page.goto(base + '/expenses')
  await m.page.getByTestId('expense-row').first().waitFor()
  await shot(m.page, 'expenses-mobile.png')
  await m.ctx.close()
}

await browser.close()
