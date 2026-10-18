import { useState } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { errorMessage } from '../api'
import ConfirmDialog from './ConfirmDialog'
import { useNotify } from './notifyContext'

interface Props {
  title: string
  text: string
  successMessage: string
  label?: string
  /** Само действие удаления; бросает ошибку — покажем уведомление. */
  action: () => Promise<void>
  onDone?: () => void
}

/** Кнопка-корзина: подтверждение в диалоге, блокировка на время запроса, уведомление о результате. */
export default function ConfirmDeleteButton({ title, text, successMessage, label = 'Удалить', action, onDone }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const notify = useNotify()

  const confirm = async () => {
    setBusy(true)
    try {
      await action()
      setOpen(false)
      notify(successMessage)
      onDone?.()
    } catch (e) {
      setOpen(false)
      notify(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Tooltip title={label}>
        <IconButton size="small" color="error" aria-label={label} onClick={(e) => { e.stopPropagation(); setOpen(true) }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <ConfirmDialog open={open} title={title} text={text} busy={busy} onConfirm={confirm} onClose={() => setOpen(false)} />
    </>
  )
}
