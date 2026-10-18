import { z } from 'zod'
import { MONEY_PATTERN, toKopecks } from './money'

/** Правила валидации повторяют схемы backend (backend/app/schemas.py). */

export const textField = (label: string, max: number) =>
  z.string().trim().min(1, `Укажите: ${label}`).max(max, `${label}: не более ${max} символов`)

export const emailField = z
  .string()
  .trim()
  .min(1, 'Укажите email')
  .max(255, 'Email: не более 255 символов')
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Введите корректный email, например ivanov@example.com')

export const dateField = z
  .string()
  .min(1, 'Укажите дату')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Некорректная дата')

/** Сумма: число до 2 знаков после запятой; allowZero — для плановой суммы (>= 0). */
export const moneyField = (allowZero = false) =>
  z
    .string()
    .trim()
    .min(1, 'Укажите сумму')
    .regex(MONEY_PATTERN, 'Сумма: число не более чем с 2 знаками после запятой')
    .refine((v) => !MONEY_PATTERN.test(v) || (allowZero ? toKopecks(v) >= 0 : toKopecks(v) > 0), 'Сумма должна быть больше нуля')

export const selectField = (label: string) => z.string().min(1, `Выберите: ${label}`)
