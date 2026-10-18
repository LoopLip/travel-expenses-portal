import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Grow } from '@mui/material'
import { useMotionTimeout } from '../lib/useMotion'

interface Props {
  open: boolean
  title: string
  text: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Диалог подтверждения опасного действия (удаление). */
export default function ConfirmDialog({ open, title, text, confirmLabel = 'Удалить', busy, onConfirm, onClose }: Props) {
  const timeout = useMotionTimeout()
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} slots={{ transition: Grow }} transitionDuration={timeout} aria-labelledby="confirm-title">
      <DialogTitle id="confirm-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={busy}>
          {busy ? 'Удаляем…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
