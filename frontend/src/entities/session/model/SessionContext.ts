import { createContext, useContext } from 'react'
import type { GuardState } from './guard'
import type { SessionUser } from './types'

export interface SessionValue {
  status: GuardState
  user: SessionUser | null
  /** Как закончилась прошлая сессия: logout — пользователь вышел сам, lost — сессию нельзя восстановить (истёк refresh). */
  lastExit: 'logout' | 'lost' | null
  login: (email: string, password: string) => Promise<void>
  register: (data: { full_name: string; email: string; password: string; department?: string }) => Promise<void>
  logout: () => Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession нужно вызывать внутри SessionProvider')
  return value
}
