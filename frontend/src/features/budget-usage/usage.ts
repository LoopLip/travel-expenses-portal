import { budgetApi } from '@/entities/budget'
import type { BudgetSummary } from '@/entities/budget'
import { toKopecks } from '@/shared/lib'

export interface BudgetUsage extends BudgetSummary {
  percent: number
}

/** Процент использования по сводке сервера (резерв считает backend: GET /budgets/{id}/summary). */
export function withPercent(summary: BudgetSummary): BudgetUsage {
  const limit = toKopecks(summary.limit_amount)
  return { ...summary, percent: limit > 0 ? Math.round((toKopecks(summary.reserved) / limit) * 100) : 0 }
}

/** Все бюджеты с использованием: список, затем сводки параллельно (бюджетов в отделах немного). */
export async function loadBudgetUsage(signal?: AbortSignal): Promise<BudgetUsage[]> {
  const budgets = await budgetApi.list(signal)
  const summaries = await Promise.all(budgets.map((b) => budgetApi.summary(b.id, signal)))
  return summaries.map(withPercent)
}
