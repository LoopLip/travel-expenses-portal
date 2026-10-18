import type { Trip } from './types'

export const seedTrips = (): Trip[] => [
  { id: 1, destination: 'Санкт-Петербург', purpose: 'Встреча с клиентом', start_date: '2026-10-12', end_date: '2026-10-15', status: 'approved', planned_amount: '85000.00', user_id: 1, budget_id: 1, created_at: '2026-10-01T09:00:00Z' },
  { id: 2, destination: 'Казань', purpose: 'Конференция разработчиков', start_date: '2026-11-03', end_date: '2026-11-06', status: 'pending', planned_amount: '72000.00', user_id: 2, budget_id: 2, created_at: '2026-10-02T10:30:00Z' },
  { id: 3, destination: 'Новосибирск', purpose: 'Открытие филиала', start_date: '2026-09-01', end_date: '2026-09-05', status: 'completed', planned_amount: '140000.00', user_id: 3, budget_id: 1, created_at: '2026-08-20T08:15:00Z' },
  { id: 4, destination: 'Екатеринбург', purpose: 'Выставка', start_date: '2026-11-20', end_date: '2026-11-22', status: 'draft', planned_amount: '64000.00', user_id: 4, budget_id: 3, created_at: '2026-10-03T14:00:00Z' },
  { id: 5, destination: 'Сочи', purpose: 'Корпоративное обучение', start_date: '2026-10-25', end_date: '2026-10-28', status: 'rejected', planned_amount: '95000.00', user_id: 1, budget_id: 1, created_at: '2026-10-04T11:45:00Z' },
]
