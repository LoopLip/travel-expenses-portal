import { moneyField, textField, z } from '@/shared/lib'

/** Правила повторяют BudgetCreate в backend: отдел до 120 символов, период до 40, лимит больше нуля. */
export const budgetFormSchema = z.object({
  department: textField('отдел', 120),
  period: textField('период', 40),
  limit_amount: moneyField(false),
})

export type BudgetFormValues = z.infer<typeof budgetFormSchema>
