export interface Budget {
  id: number
  department: string
  period: string
  /** Деньги в API — строки: "600000.00". */
  limit_amount: string
}

/** Ответ GET /budgets/{id}/summary. */
export interface BudgetSummary extends Budget {
  reserved: string
  remaining: string
}
