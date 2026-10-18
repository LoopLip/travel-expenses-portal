import type { Budget } from './types'

export const seedBudgets = (): Budget[] => [
  { id: 1, department: 'Продажи', period: '2026-Q4', limit_amount: '600000.00' },
  { id: 2, department: 'Разработка', period: '2026-Q4', limit_amount: '350000.00' },
  { id: 3, department: 'Маркетинг', period: '2026-Q4', limit_amount: '200000.00' },
]
