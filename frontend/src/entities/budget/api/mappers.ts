import { parseResponse } from '@/shared/api'
import { apiId, apiMoney, normalizeMoney, z } from '@/shared/lib'
import type { BudgetFormValues } from '../model/schema'
import type { Budget, BudgetCreate, BudgetSummary } from '../model/types'

const budgetDto = z.object({
  id: apiId,
  department: z.string(),
  period: z.string(),
  limit_amount: apiMoney,
})

const summaryDto = budgetDto.extend({ reserved: apiMoney, remaining: apiMoney })

export const toBudget = (data: unknown): Budget => parseResponse(budgetDto, data)
export const toBudgets = (data: unknown): Budget[] => parseResponse(z.array(budgetDto), data)
export const toBudgetSummary = (data: unknown): BudgetSummary => parseResponse(summaryDto, data)

/** Значения формы → тело POST /budgets и PATCH /budgets/{id}. */
export const toBudgetPayload = (v: BudgetFormValues): BudgetCreate => ({
  department: v.department.trim(),
  period: v.period.trim(),
  limit_amount: normalizeMoney(v.limit_amount),
})
