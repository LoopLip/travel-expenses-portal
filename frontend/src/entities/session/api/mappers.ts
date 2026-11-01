import { parseResponse } from '@/shared/api'
import { apiId, z } from '@/shared/lib'
import type { SessionUser } from '../model/types'

/** Схема UserOut. Хеша пароля в ответе нет и быть не должно. */
const userDto = z.object({
  id: apiId,
  full_name: z.string(),
  email: z.string(),
  department: z.string().nullable(),
  role: z.enum(['employee', 'manager', 'accountant']),
})

export const toUser = (data: unknown): SessionUser => parseResponse(userDto, data)
export const toUsers = (data: unknown): SessionUser[] => parseResponse(z.array(userDto), data)
