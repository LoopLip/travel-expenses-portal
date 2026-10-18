import { dateField, moneyField, selectField, textField, z } from '@/shared/lib'

export const expenseFormSchema = z.object({
  trip_id: selectField('командировка'),
  category: selectField('категория'),
  description: textField('описание', 255),
  amount: moneyField(false),
  expense_date: dateField,
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>
