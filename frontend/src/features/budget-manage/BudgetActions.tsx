import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { budgetApi } from '@/entities/budget'
import type { Budget } from '@/entities/budget'
import { ConfirmDeleteButton } from '@/shared/ui'
import BudgetDialog from './BudgetDialog'

export function EditBudgetButton({ budget }: { budget: Budget }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title="Изменить бюджет">
        <IconButton size="small" aria-label="Изменить бюджет" onClick={() => setOpen(true)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <BudgetDialog open={open} onClose={() => setOpen(false)} budget={budget} />
    </>
  )
}

/** Удалить можно только бюджет без командировок: иначе сервер ответит 409 и текст покажется в уведомлении. */
export function DeleteBudgetButton({ budget }: { budget: Budget }) {
  return (
    <ConfirmDeleteButton
      title="Удалить бюджет?"
      text={`Бюджет «${budget.department} (${budget.period})» будет удалён. Бюджет, к которому привязаны командировки, удалить нельзя.`}
      successMessage="Бюджет удалён"
      label="Удалить бюджет"
      action={() => budgetApi.remove(budget.id)}
    />
  )
}
