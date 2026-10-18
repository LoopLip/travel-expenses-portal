import { createCollection } from '@/shared/api'
import { seedUsers } from '../model/seed'
import type { User } from '../model/types'

const users = createCollection<User>('users', seedUsers, 'Пользователь')

export const userApi = {
  list: () => users.list(),
  get: (id: number) => users.get(id),
}
