import type { Expense } from './types'

export const expenses: Expense[] = [
  { id: 1, tripId: 3, category: 'transport', description: 'Авиабилеты Москва — Новосибирск', amount: 48200, date: '2026-09-01', hasReceipt: true },
  { id: 2, tripId: 3, category: 'lodging', description: 'Гостиница, 4 ночи', amount: 36000, date: '2026-09-05', hasReceipt: true },
  { id: 3, tripId: 3, category: 'meals', description: 'Питание', amount: 11400, date: '2026-09-03', hasReceipt: false },
  { id: 4, tripId: 1, category: 'transport', description: 'Сапсан, туда-обратно', amount: 9800, date: '2026-10-12', hasReceipt: true },
  { id: 5, tripId: 1, category: 'lodging', description: 'Бронь отеля', amount: 24000, date: '2026-10-12', hasReceipt: true },
]
