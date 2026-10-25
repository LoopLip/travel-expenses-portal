import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { resolveGuest, resolveProtected, useSession } from '@/entities/session'

function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }} data-testid="session-loading">
      <CircularProgress aria-label="Проверяем вход" />
    </Box>
  )
}

/** Закрытые страницы: гостя отправляем на /login и запоминаем, куда он шёл. */
export function ProtectedRoute() {
  const { status, lastExit } = useSession()
  const location = useLocation()
  const decision = resolveProtected(status, location, lastExit !== 'logout')
  if (decision.type === 'wait') return <Loading />
  if (decision.type === 'redirect') return <Navigate to={decision.to} state={{ from: decision.from }} replace />
  return <Outlet />
}

/** Вход и регистрация: вошедшего пользователя возвращаем на страницу, с которой его отправили на вход. */
export function GuestRoute() {
  const { status } = useSession()
  const location = useLocation()
  const decision = resolveGuest(status, (location.state as { from?: string } | null)?.from)
  if (decision.type === 'wait') return <Loading />
  if (decision.type === 'redirect') return <Navigate to={decision.to} replace />
  return <Outlet />
}
