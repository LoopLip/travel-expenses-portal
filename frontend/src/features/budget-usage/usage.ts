import { NON_RESERVING } from '@/entities/trip'
import type { Trip } from '@/entities/trip'
import type { Budget, BudgetSummary } from '@/entities/budget'
import { fromKopecks, sumKopecks, toKopecks } from '@/shared/lib'

export interface BudgetUsage extends BudgetSummary {
  percent: number
}

/** Аналог GET /budgets/{id}/summary: резерв = плановые суммы поездок, кроме черновиков и отклонённых. */
export function computeBudgetUsage(budgets: Budget[], trips: Trip[]): BudgetUsage[] {
  return budgets.map((b) => {
    const reserved = sumKopecks(trips.filter((t) => t.budget_id === b.id && !NON_RESERVING.includes(t.status)).map((t) => t.planned_amount))
    const limit = toKopecks(b.limit_amount)
    return {
      ...b,
      reserved: fromKopecks(reserved),
      remaining: fromKopecks(limit - reserved),
      percent: limit > 0 ? Math.round((reserved / limit) * 100) : 0,
    }
  })
}
