import { createCollection } from '@/shared/api'
import { seedBudgets } from '../model/seed'
import type { Budget } from '../model/types'

const budgets = createCollection<Budget>('budgets', seedBudgets, 'Бюджет')

export const budgetApi = {
  list: () => budgets.list(),
  get: (id: number) => budgets.get(id),
}
