import type { ReactNode } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grow } from '@mui/material'
import { useMotionTimeout } from '../lib/useMotion'

interface Props {
  open: boolean
  title: string
  submitLabel: string
  submitting: boolean
  onClose: () => void
  /** id формы внутри children: кнопка отправки привязана к ней атрибутом form. */
  formId: string
  children: ReactNode
}

/** Диалог с формой: плавно плавно увеличивается, кнопка отправки блокируется на время отправки. */
export default function FormDialog({ open, title, submitLabel, submitting, onClose, formId, children }: Props) {
  const timeout = useMotionTimeout()
  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      slots={{ transition: Grow }}
      transitionDuration={timeout}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button type="submit" form={formId} variant="contained" disabled={submitting}>
          {submitting ? 'Сохраняем…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
