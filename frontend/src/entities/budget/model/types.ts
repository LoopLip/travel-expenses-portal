/** Бюджет отдела (ответ BudgetOut). Деньги — строки «600000.00». */
export interface Budget {
  id: number
  department: string
  period: string
  limit_amount: string
}

/** Ответ GET /budgets/{id}/summary: резерв считает сервер (плановые суммы поездок, кроме черновиков и отклонённых). */
export interface BudgetSummary extends Budget {
  reserved: string
  remaining: string
}

export interface BudgetCreate {
  department: string
  period: string
  limit_amount: string
}

export type BudgetUpdate = Partial<BudgetCreate>
