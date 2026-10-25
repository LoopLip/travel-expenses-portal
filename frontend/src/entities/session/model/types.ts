export type Role = 'employee' | 'manager' | 'accountant'

/** Пользователь в ответах backend (UserOut). Хеша пароля в ответах нет. */
export interface SessionUser {
  id: number
  full_name: string
  email: string
  department: string | null
  role: Role
}

export const roleLabel: Record<Role, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  accountant: 'Бухгалтер',
}

export const isStaff = (role: Role): boolean => role === 'manager' || role === 'accountant'
