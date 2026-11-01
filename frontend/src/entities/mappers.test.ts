import { describe, expect, it, vi } from 'vitest'
import { toAdvances } from '@/entities/advance'
import { toBudgetPayload, toBudgetSummary } from '@/entities/budget'
import { toExpense, toExpenseCreate, toExpenseUpdate } from '@/entities/expense'
import { toUser } from '@/entities/session'
import { toTrip, toTripCreate, toTripUpdate, toTrips } from '@/entities/trip'
import type { TripFormValues } from '@/entities/trip'
import { formatDate, normalizeMoney, toKopecks } from '@/shared/lib'

// Ответы в том виде, в каком их отдаёт backend (проверено запросами к запущенному API)
const tripJson = {
  id: 1, destination: 'Казань', purpose: '', start_date: '2026-12-01', end_date: '2026-12-03', status: 'pending',
  planned_amount: '5000.50', user_id: 3, budget_id: 2, created_at: '2026-11-01T11:28:40.616260Z',
}

describe('мапперы ответов сервера', () => {
  it('командировка: поля как в API, лишние поля TripDetail отбрасываются', () => {
    const trip = toTrip({ ...tripJson, advances: [{ id: 1 }], expenses: [] })
    expect(trip).toEqual(tripJson)
    expect('advances' in trip).toBe(false)
  })

  it('деньги приводятся к виду «0.00» (в т.ч. «0» из сводки бюджета и отрицательный остаток)', () => {
    expect(toTrip({ ...tripJson, planned_amount: '0' }).planned_amount).toBe('0.00')
    const s = toBudgetSummary({ id: 1, department: 'Продажи', period: '2026-Q4', limit_amount: '1000.00', reserved: '0', remaining: '-250.5' })
    expect(s).toMatchObject({ reserved: '0.00', remaining: '-250.50' })
  })

  it('неизвестный статус или неверный формат даты — понятная ошибка «Некорректный ответ сервера»', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => toTrip({ ...tripJson, status: 'archived' })).toThrow('Некорректный ответ сервера')
    expect(() => toTrips([{ ...tripJson, start_date: '01.12.2026' }])).toThrow(expect.objectContaining({ status: 502 }))
    expect(() => toAdvances({ detail: 'не список' })).toThrow('Некорректный ответ сервера')
    quiet.mockRestore()
  })

  it('расход и пользователь: null в необязательных полях допустим', () => {
    expect(toExpense({ id: 5, trip_id: 1, category: 'meals', description: 'Обед', amount: '700.1', expense_date: '2026-12-01', receipt_url: null }).amount).toBe('700.10')
    expect(toUser({ id: 2, full_name: 'Иванов Иван', email: 'ivanov@example.com', department: null, role: 'employee' }).role).toBe('employee')
  })
})

describe('мапперы форм → тело запроса', () => {
  const values: TripFormValues = {
    destination: '  Казань ', purpose: ' Конференция ', start_date: '2026-11-03', end_date: '2026-11-06',
    planned_amount: '72000,5', user_id: '7', budget_id: '2',
  }

  it('командировка: обрезка пробелов, сумма с точкой и копейками, id числами', () => {
    expect(toTripCreate(values, true)).toEqual({
      destination: 'Казань', purpose: 'Конференция', start_date: '2026-11-03', end_date: '2026-11-06',
      planned_amount: '72000.50', budget_id: 2, user_id: 7,
    })
  })

  it('сотрудник не отправляет user_id (сервер оформит на него самого), при изменении user_id не отправляется', () => {
    expect(toTripCreate(values, false)).not.toHaveProperty('user_id')
    expect(toTripUpdate(values)).not.toHaveProperty('user_id')
  })

  it('расход: trip_id только при создании', () => {
    const form = { trip_id: '4', category: 'meals', description: ' Обед ', amount: '500', expense_date: '2026-11-04' }
    expect(toExpenseCreate(form, null)).toEqual({ trip_id: 4, category: 'meals', description: 'Обед', amount: '500.00', expense_date: '2026-11-04', receipt_url: null })
    expect(toExpenseUpdate(form, 'receipts/chek.jpg')).not.toHaveProperty('trip_id')
  })

  it('бюджет', () => {
    expect(toBudgetPayload({ department: ' Продажи ', period: '2026-Q4', limit_amount: '600000' })).toEqual({ department: 'Продажи', period: '2026-Q4', limit_amount: '600000.00' })
  })
})

describe('форматы денег и дат', () => {
  it('копейки и отрицательные суммы', () => {
    expect(toKopecks('-250.5')).toBe(-25050)
    expect(normalizeMoney('-0.5')).toBe('-0.50')
    expect(normalizeMoney(1000.5)).toBe('1000.50')
  })

  it('дата без времени показывается тем же календарным днём в любом часовом поясе', () => {
    expect(formatDate('2026-12-01')).toBe('01.12.2026')
  })
})
