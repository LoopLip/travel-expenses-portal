import type { ReactNode } from 'react'
import { Alert, AlertTitle, Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'

/** Состояние «загрузка»: скелетоны вместо контента. */
export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <Stack spacing={1.5} role="status" aria-label="Загрузка данных" data-testid="state-loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={44} animation="wave" />
      ))}
    </Stack>
  )
}

/** Состояние «ошибка»: сообщение и кнопка «Повторить». */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      data-testid="state-error"
      action={onRetry && <Button color="inherit" size="small" onClick={onRetry}>Повторить</Button>}
    >
      <AlertTitle>Не удалось загрузить данные</AlertTitle>
      {message}
    </Alert>
  )
}

interface EmptyProps {
  title: string
  description?: string
  action?: ReactNode
}

/** Состояние «нет данных»: пояснение и кнопка действия. */
export function EmptyState({ title, description, action }: EmptyProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }} data-testid="state-empty">
      <InboxOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled' }} />
      <Typography variant="h6" sx={{ mt: 1 }}>{title}</Typography>
      {description && <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>{description}</Typography>}
      {action}
    </Box>
  )
}
