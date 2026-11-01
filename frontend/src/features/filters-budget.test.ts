import { describe, expect, it } from 'vitest'
import type { BudgetSummary } from '@/entities/budget'
import { withPercent } from '@/features/budget-usage'
import { initialTripFilter, isFilterActive, toTripListFilter } from '@/features/trip-filter'

const summary = (limit: string, reserved: string): BudgetSummary => ({
  id: 1, department: 'Продажи', period: '2026-Q4', limit_amount: limit, reserved, remaining: '0.00',
})

describe('использование бюджета по сводке сервера', () => {
  it('процент считается от лимита и округляется', () => {
    expect(withPercent(summary('600000.00', '72000.00')).percent).toBe(12)
    expect(withPercent(summary('300000.00', '0.00')).percent).toBe(0)
    expect(withPercent(summary('1000.00', '1500.00')).percent).toBe(150) // перерасход виден, полосу ограничивает AnimatedBar
  })
})

describe('фильтр командировок → параметры GET /trips', () => {
  it('«все» и пустой поиск не отправляются', () => {
    expect(toTripListFilter(initialTripFilter)).toEqual({ status: undefined, q: undefined })
    expect(isFilterActive(initialTripFilter)).toBe(false)
  })
  it('статус и поиск (с обрезкой пробелов) уходят на сервер', () => {
    expect(toTripListFilter({ status: 'draft', search: '  казань ' })).toEqual({ status: 'draft', q: 'казань' })
    expect(isFilterActive({ status: 'all', search: 'x' })).toBe(true)
  })
})
