import { describe, expect, it } from 'vitest'
import { resolveGuest, resolveProtected, safeReturnPath } from './guard'
import { loginSchema, registerSchema } from './schema'

describe('охрана маршрутов', () => {
  it('пока сессия восстанавливается, никуда не перенаправляет', () => {
    expect(resolveProtected('loading', { pathname: '/trips' })).toEqual({ type: 'wait' })
    expect(resolveGuest('loading')).toEqual({ type: 'wait' })
  })
  it('гостя с закрытой страницы отправляет на /login и запоминает адрес', () => {
    expect(resolveProtected('anonymous', { pathname: '/trips/2', search: '?tab=x' })).toEqual({ type: 'redirect', to: '/login', from: '/trips/2?tab=x' })
  })
  it('после явного выхода адрес не запоминается', () => {
    expect(resolveProtected('anonymous', { pathname: '/trips' }, false)).toEqual({ type: 'redirect', to: '/login', from: undefined })
  })
  it('вошедшему закрытая страница доступна', () => {
    expect(resolveProtected('authenticated', { pathname: '/trips' })).toEqual({ type: 'allow' })
  })
  it('вошедшего не пускает на /login: возвращает на запрошенную страницу или на главную', () => {
    expect(resolveGuest('authenticated', '/trips/2')).toEqual({ type: 'redirect', to: '/trips/2' })
    expect(resolveGuest('authenticated')).toEqual({ type: 'redirect', to: '/' })
    expect(resolveGuest('anonymous')).toEqual({ type: 'allow' })
  })
  it('возврат только на внутренние адреса', () => {
    expect(safeReturnPath('https://evil.example')).toBe('/')
    expect(safeReturnPath('//evil.example')).toBe('/')
    expect(safeReturnPath('/login')).toBe('/')
    expect(safeReturnPath('/budgets')).toBe('/budgets')
  })
})

const messages = (r: { success: boolean; error?: { issues: Array<{ message: string }> } }) => r.error?.issues.map((i) => i.message) ?? []

describe('валидация формы входа', () => {
  it('принимает корректные данные', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'x' }).success).toBe(true)
  })
  it('требует email нужного вида и пароль', () => {
    const r = loginSchema.safeParse({ email: 'не-email', password: '' })
    expect(messages(r)).toEqual(expect.arrayContaining(['Введите корректный email, например ivanov@example.com', 'Введите пароль']))
  })
})

describe('валидация формы регистрации (правила backend)', () => {
  const valid = { full_name: 'Иванов Иван', email: 'ivanov@example.com', department: '', password: 'correct-horse', confirm: 'correct-horse' }
  it('принимает корректные данные', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })
  it('пароль не короче 8 и не длиннее 128 символов', () => {
    expect(messages(registerSchema.safeParse({ ...valid, password: '1234567', confirm: '1234567' }))).toContain('Пароль: не короче 8 символов')
    expect(registerSchema.safeParse({ ...valid, password: 'x'.repeat(129), confirm: 'x'.repeat(129) }).success).toBe(false)
    expect(registerSchema.safeParse({ ...valid, password: '12345678', confirm: '12345678' }).success).toBe(true)
  })
  it('пароли должны совпадать', () => {
    expect(messages(registerSchema.safeParse({ ...valid, confirm: 'другой-пароль' }))).toContain('Пароли не совпадают')
  })
  it('имя обязательно и не длиннее 120 символов', () => {
    expect(registerSchema.safeParse({ ...valid, full_name: '  ' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...valid, full_name: 'я'.repeat(121) }).success).toBe(false)
  })
})
