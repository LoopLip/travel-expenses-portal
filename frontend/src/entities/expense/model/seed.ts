import type { Expense } from './types'

export const seedExpenses = (): Expense[] => [
  { id: 1, trip_id: 3, category: 'transport', description: 'Авиабилеты Москва — Новосибирск', amount: '48200.00', expense_date: '2026-09-01', receipt_url: 'receipts/avia.jpg' },
  { id: 2, trip_id: 3, category: 'lodging', description: 'Гостиница, 4 ночи', amount: '36000.00', expense_date: '2026-09-05', receipt_url: 'receipts/hotel.jpg' },
  { id: 3, trip_id: 3, category: 'meals', description: 'Питание', amount: '11400.00', expense_date: '2026-09-03', receipt_url: null },
  { id: 4, trip_id: 1, category: 'transport', description: 'Сапсан, туда-обратно', amount: '9800.00', expense_date: '2026-10-12', receipt_url: 'receipts/train.jpg' },
  { id: 5, trip_id: 1, category: 'lodging', description: 'Бронь отеля', amount: '24000.00', expense_date: '2026-10-12', receipt_url: 'receipts/booking.jpg' },
]
