import { http, tokenStore } from '@/shared/api'
import type { TokenResponse } from '@/shared/api'
import type { SessionUser } from '../model/types'

export interface RegisterData {
  full_name: string
  email: string
  password: string
  department?: string
}

/** Реальные запросы к backend (/auth/*). Остальные данные приложения до ЛР №5 — демонстрационные. */
export const authApi = {
  register: (data: RegisterData) =>
    http.request<SessionUser>('/auth/register', {
      method: 'POST',
      auth: false,
      json: { ...data, department: data.department?.trim() || null },
    }),

  /** Вход: access-токен сохраняется в памяти, refresh-токен браузер получает в HttpOnly-cookie. */
  async login(email: string, password: string): Promise<void> {
    const res = await http.request<TokenResponse>('/auth/login', { method: 'POST', auth: false, form: { username: email, password } })
    tokenStore.set(res.access_token)
  },

  me: () => http.request<SessionUser>('/auth/me'),

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

/** Список пользователей (GET /users): только руководитель и бухгалтер, остальным backend отвечает 403. */
export const accountsApi = {
  list: () => http.request<SessionUser[]>('/users'),
}
