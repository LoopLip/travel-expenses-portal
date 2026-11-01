import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import type { Advance } from '@/entities/advance'
import AdvanceRequestDialog from './AdvanceRequestDialog'

/** Кнопка-карандаш: изменение суммы аванса (PATCH /advances/{id}) в пределах плановой суммы командировки. */
export default function EditAdvanceButton({ advance }: { advance: Advance }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Tooltip title="Изменить сумму">
        <IconButton size="small" aria-label="Изменить аванс" onClick={() => setOpen(true)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <AdvanceRequestDialog open={open} onClose={() => setOpen(false)} advance={advance} />
    </>
  )
}
