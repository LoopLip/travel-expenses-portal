import { budgetApi } from '@/entities/budget'
import { tripApi } from '@/entities/trip'
import { useQuery } from '@/shared/lib'
import { computeBudgetUsage } from './usage'

/** Использование бюджетов; обновляется после любых изменений командировок. */
export const useBudgetUsage = () =>
  useQuery(async () => {
    const [budgets, trips] = await Promise.all([budgetApi.list(), tripApi.list()])
    return computeBudgetUsage(budgets, trips)
  })
