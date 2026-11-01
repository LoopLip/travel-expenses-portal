import { MAX_LIST_LIMIT, http, tokenStore } from '@/shared/api'
import type { TokenResponse } from '@/shared/api'
import type { SessionUser } from '../model/types'
import { toUser, toUsers } from './mappers'

export interface RegisterData {
  full_name: string
  email: string
  password: string
  department?: string
}

/** Запросы аутентификации (/auth/*). */
export const authApi = {
  register: (data: RegisterData): Promise<SessionUser> =>
    http
      .request<unknown>('/auth/register', {
        method: 'POST',
        auth: false,
        json: { ...data, department: data.department?.trim() || null },
      })
      .then(toUser),

  /** Вход: access-токен сохраняется в памяти, refresh-токен браузер получает в HttpOnly-cookie. */
  async login(email: string, password: string): Promise<void> {
    const res = await http.request<TokenResponse>('/auth/login', { method: 'POST', auth: false, form: { username: email, password } })
    tokenStore.set(res.access_token)
  },

  me: (): Promise<SessionUser> => http.request<unknown>('/auth/me').then(toUser),

  /** Тихое восстановление сессии после перезагрузки страницы: refresh-cookie → новый access-токен. */
  restore: () => http.refresh(),

  /** Выход: backend отзывает refresh-токен сессии и удаляет cookie; токен в памяти очищается всегда. */
  async logout(): Promise<void> {
    try {
      await http.request<void>('/auth/logout', { method: 'POST', auth: false })
    } finally {
      tokenStore.clear()
    }
  },
}

/** Пользователи (/users). Список доступен руководителю и бухгалтеру; свой профиль может прочитать каждый. */
export const usersApi = {
  list: (signal?: AbortSignal): Promise<SessionUser[]> =>
    http.request<unknown>('/users', { params: { limit: MAX_LIST_LIMIT }, signal }).then(toUsers),
  get: (id: number, signal?: AbortSignal): Promise<SessionUser> => http.request<unknown>(`/users/${id}`, { signal }).then(toUser),
}
