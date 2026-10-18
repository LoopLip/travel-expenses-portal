import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Slide, Snackbar } from '@mui/material'
import { useMotionTimeout } from '../lib/useMotion'
import { NotifyContext } from './notifyContext'
import type { Severity } from './notifyContext'

interface Message {
  key: number
  text: string
  severity: Severity
}


/** Уведомления (snackbar): «Командировка создана», «Не удалось сохранить» и т. п. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null)
  const [open, setOpen] = useState(false)
  const timeout = useMotionTimeout(300)

  const notify = useCallback((text: string, severity: Severity = 'success') => {
    setMessage({ key: Date.now(), text, severity })
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        key={message?.key}
        open={open}
        autoHideDuration={4000}
        onClose={(_, reason) => reason !== 'clickaway' && setOpen(false)}
        slots={{ transition: Slide }}
        transitionDuration={timeout}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={message?.severity ?? 'success'} variant="filled" onClose={() => setOpen(false)} role="status" data-testid="snackbar">
          {message?.text}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  )
}

