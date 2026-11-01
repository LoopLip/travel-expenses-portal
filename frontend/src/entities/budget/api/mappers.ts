import { parseResponse } from '@/shared/api'
import { apiId, apiMoney, z } from '@/shared/lib'
import type { Budget, BudgetSummary } from '../model/types'

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
