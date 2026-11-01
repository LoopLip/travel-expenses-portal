import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import type { Expense } from '@/entities/expense'
import ExpenseDialog from './ExpenseDialog'

/** Кнопка-карандаш: открывает диалог изменения расхода (PATCH /expenses/{id}). */
export default function EditExpenseButton({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title="Изменить расход">
        <IconButton size="small" aria-label="Изменить расход" onClick={() => setOpen(true)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <ExpenseDialog open={open} onClose={() => setOpen(false)} expense={expense} />
    </>
  )
}
