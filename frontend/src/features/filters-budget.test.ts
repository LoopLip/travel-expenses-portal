import { describe, expect, it } from 'vitest'
import type { Budget } from '@/entities/budget'
import type { Trip } from '@/entities/trip'
import type { User } from '@/entities/user'
import { computeBudgetUsage } from '@/features/budget-usage'
import { applyTripFilter, initialTripFilter } from '@/features/trip-filter'

const trip = (id: number, status: Trip['status'], planned: string, destination = 'Город'): Trip => ({
  id, destination, purpose: '', start_date: '2026-11-01', end_date: '2026-11-02', status,
  planned_amount: planned, user_id: 1, budget_id: 1, created_at: '2026-10-01T00:00:00Z',
})
const budgets: Budget[] = [{ id: 1, department: 'Продажи', period: '2026-Q4', limit_amount: '600000.00' }]
const users: User[] = [{ id: 1, full_name: 'Иванов Иван', email: 'i@example.com', department: null }]

describe('резерв бюджета', () => {
  it('не учитывает черновики и отклонённые поездки', () => {
    const [u] = computeBudgetUsage(budgets, [trip(1, 'approved', '72000.00'), trip(2, 'draft', '100000.00'), trip(3, 'rejected', '50000.00')])
    expect(u.reserved).toBe('72000.00')
    expect(u.remaining).toBe('528000.00')
    expect(u.percent).toBe(12)
  })
})

describe('фильтр командировок', () => {
  const trips = [trip(1, 'approved', '1', 'Казань'), trip(2, 'draft', '1', 'Сочи')]
  it('по статусу', () => {
    expect(applyTripFilter(trips, users, { ...initialTripFilter, status: 'draft' }).map((t) => t.id)).toEqual([2])
  })
  it('по тексту: направление и ФИО, без учёта регистра', () => {
    expect(applyTripFilter(trips, users, { ...initialTripFilter, search: 'каз' }).map((t) => t.id)).toEqual([1])
    expect(applyTripFilter(trips, users, { ...initialTripFilter, search: 'ИВАНОВ' })).toHaveLength(2)
  })
})
