import { describe, expect, it } from 'vitest'
import { expenseFormSchema } from '@/entities/expense'
import { tripFormSchema } from '@/entities/trip'
import type { TripFormValues } from '@/entities/trip'

const validTrip: TripFormValues = {
  destination: 'Казань', purpose: '', start_date: '2026-11-03', end_date: '2026-11-06',
  planned_amount: '72000', user_id: '1', budget_id: '1',
}
const messages = (r: { success: boolean; error?: { issues: Array<{ message: string }> } }) => r.error?.issues.map((i) => i.message) ?? []

describe('валидация командировки (правила backend)', () => {
  it('принимает корректные данные', () => {
    expect(tripFormSchema.safeParse(validTrip).success).toBe(true)
  })
  it('требует обязательные поля', () => {
    const r = tripFormSchema.safeParse({ ...validTrip, destination: '  ', user_id: '' })
    expect(messages(r)).toEqual(expect.arrayContaining(['Укажите: направление', 'Выберите: сотрудник']))
  })
  it('дата окончания не раньше даты начала', () => {
    const r = tripFormSchema.safeParse({ ...validTrip, end_date: '2026-11-01' })
    expect(messages(r)).toContain('Дата окончания не может быть раньше даты начала')
  })
  it('сумма: не более 2 знаков и неотрицательная; ноль допустим для плана', () => {
    expect(tripFormSchema.safeParse({ ...validTrip, planned_amount: '10.123' }).success).toBe(false)
    expect(tripFormSchema.safeParse({ ...validTrip, planned_amount: '-5' }).success).toBe(false)
    expect(tripFormSchema.safeParse({ ...validTrip, planned_amount: '0' }).success).toBe(true)
  })
  it('ограничивает длину направления (120)', () => {
    expect(tripFormSchema.safeParse({ ...validTrip, destination: 'я'.repeat(121) }).success).toBe(false)
  })
})

describe('валидация расхода', () => {
  const valid = { trip_id: '1', category: 'meals', description: 'Обед', amount: '500', expense_date: '2026-11-04' }
  it('сумма расхода должна быть больше нуля', () => {
    expect(expenseFormSchema.safeParse(valid).success).toBe(true)
    expect(messages(expenseFormSchema.safeParse({ ...valid, amount: '0' }))).toContain('Сумма должна быть больше нуля')
    expect(expenseFormSchema.safeParse({ ...valid, amount: '-5' }).success).toBe(false)
  })
})
