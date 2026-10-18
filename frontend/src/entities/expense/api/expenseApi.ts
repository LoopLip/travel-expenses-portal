import { createCollection } from '@/shared/api'
import { seedExpenses } from '../model/seed'
import type { Expense, ExpenseCreate, ExpenseUpdate } from '../model/types'

const expenses = createCollection<Expense>('expenses', seedExpenses, 'Расход')

export const expenseApi = {
  list: () => expenses.list(),
  get: (id: number) => expenses.get(id),
  create: (data: ExpenseCreate) => expenses.insert((id) => ({ ...data, id })),
  update: (id: number, changes: ExpenseUpdate) => expenses.patch(id, changes),
  remove: (id: number) => expenses.remove(id),
}
