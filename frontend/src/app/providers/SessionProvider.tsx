import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { SessionContext, authApi } from '@/entities/session'
import type { GuardState, SessionUser, SessionValue } from '@/entities/session'
import { http } from '@/shared/api'

let restoring: Promise<SessionUser | null> | null = null

/** Восстановление сессии при загрузке страницы. Общий промис нужен из-за двойного запуска эффектов в StrictMode:
 *  два одинаковых refresh подряд отозвали бы сессию (второй предъявил бы уже использованный токен). */
function restoreSession(): Promise<SessionUser | null> {
  if (!restoring) {
    restoring = (async () => {
      try {
        return (await authApi.restore()) ? await authApi.me() : null
      } catch {
        return null
      }
    })().finally(() => {
      restoring = null
    })
  }
  return restoring
}

/** Состояние входа для всего приложения: статус, пользователь, действия входа, регистрации и выхода. */
export default function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GuardState>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [lastExit, setLastExit] = useState<SessionValue['lastExit']>(null)

  useEffect(() => {
    http.setAuthLostHandler(() => {
      setUser(null)
      setLastExit('lost')
      setStatus('anonymous')
    })
    let cancelled = false
    restoreSession().then((restored) => {
      if (cancelled) return
      setUser(restored)
      setStatus(restored ? 'authenticated' : 'anonymous')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await authApi.login(email, password)
    setUser(await authApi.me())
    setLastExit(null)
    setStatus('authenticated')
  }, [])

  const register = useCallback<SessionValue['register']>(
    async (data) => {
      await authApi.register(data)
      await login(data.email, data.password) // после регистрации вход выполняется автоматически
    },
    [login],
  )

  const logout = useCallback(async () => {
    setLastExit('logout')
    try {
      await authApi.logout()
    } finally {
      setUser(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(() => ({ status, user, lastExit, login, register, logout }), [status, user, lastExit, login, register, logout])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
