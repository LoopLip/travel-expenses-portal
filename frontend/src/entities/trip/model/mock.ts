import type { Trip } from './types'

export const trips: Trip[] = [
  { id: 1, destination: 'Санкт-Петербург', purpose: 'Встреча с клиентом', startDate: '2026-10-12', endDate: '2026-10-15', status: 'approved', employee: 'Иванов И.', budgetId: 1, plannedAmount: 85000 },
  { id: 2, destination: 'Казань', purpose: 'Конференция разработчиков', startDate: '2026-11-03', endDate: '2026-11-06', status: 'pending', employee: 'Петрова А.', budgetId: 2, plannedAmount: 72000 },
  { id: 3, destination: 'Новосибирск', purpose: 'Открытие филиала', startDate: '2026-09-01', endDate: '2026-09-05', status: 'completed', employee: 'Сидоров П.', budgetId: 1, plannedAmount: 140000 },
  { id: 4, destination: 'Екатеринбург', purpose: 'Выставка', startDate: '2026-11-20', endDate: '2026-11-22', status: 'draft', employee: 'Козлова Е.', budgetId: 3, plannedAmount: 64000 },
  { id: 5, destination: 'Сочи', purpose: 'Корпоративное обучение', startDate: '2026-10-25', endDate: '2026-10-28', status: 'rejected', employee: 'Иванов И.', budgetId: 1, plannedAmount: 95000 },
]
