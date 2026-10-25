// Подготовка пользователей для сквозных проверок и скриншотов: выполняется на РЕАЛЬНОМ backend и БД.
// Руководитель и бухгалтер создаются командой `python -m app.cli create-user` (через API роль назначить нельзя),
// сотрудник — обычной регистрацией. Пароли случайные, создаются при каждом запуске и нигде не сохраняются.
import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const API = process.env.API_URL ?? 'http://127.0.0.1:8000'
const backendDir = process.env.BACKEND_DIR ?? path.resolve(here, '../../backend')
const python =
  process.env.PYTHON ??
  [path.join(backendDir, 'venv/Scripts/python.exe'), path.join(backendDir, 'venv/bin/python')].find(existsSync) ??
  'python'

export async function ensureBackend() {
  try {
    const res = await fetch(`${API}/health`)
    if (!res.ok) throw new Error(String(res.status))
  } catch (e) {
    throw new Error(`Backend недоступен по адресу ${API} (${e.message}). Запустите БД и backend, см. README.`)
  }
}

export async function provisionUsers() {
  const stamp = Date.now().toString(36)
  const mk = (role, label) => ({ role, label, email: `e2e-${stamp}-${role}@example.com`, password: 'Pw-' + randomBytes(9).toString('hex'), name: `${label} ${stamp}` })
  const users = { manager: mk('manager', 'Руководитель'), accountant: mk('accountant', 'Бухгалтер'), employee: mk('employee', 'Сотрудник') }
  for (const u of [users.manager, users.accountant]) {
    execFileSync(python, ['-m', 'app.cli', 'create-user', '--email', u.email, '--full-name', u.name, '--role', u.role], {
      cwd: backendDir,
      env: { ...process.env, NEW_USER_PASSWORD: u.password },
      stdio: 'pipe',
    })
  }
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: users.employee.name, email: users.employee.email, password: users.employee.password }),
  })
  if (!res.ok) throw new Error('Не удалось зарегистрировать сотрудника: ' + (await res.text()))
  return users
}

/** Вход через API (для проверок запросами): возвращает access-токен и cookie-заголовок refresh-токена. */
export async function apiLogin(user) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: user.email, password: user.password }),
  })
  if (!res.ok) throw new Error('Вход через API не удался: ' + res.status)
  const refreshCookie = res.headers.get('set-cookie').split(';')[0]
  return { access: (await res.json()).access_token, refreshCookie }
}

/** Вход через интерфейс. */
export async function loginUi(page, base, user) {
  await page.goto(base + '/login')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Пароль').fill(user.password)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.getByTestId('user-menu').waitFor()
}
