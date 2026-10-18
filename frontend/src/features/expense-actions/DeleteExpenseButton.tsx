import { expenseApi } from '@/entities/expense'
import type { Expense } from '@/entities/expense'
import { ConfirmDeleteButton } from '@/shared/ui'

export default function DeleteExpenseButton({ expense }: { expense: Expense }) {
  return (
    <ConfirmDeleteButton
      title="Удалить расход?"
      text={`Расход «${expense.description}» будет удалён. Это действие нельзя отменить.`}
      successMessage="Расход удалён"
      label="Удалить расход"
      action={() => expenseApi.remove(expense.id)}
    />
  )
}
