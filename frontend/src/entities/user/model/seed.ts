import type { User } from './types'

export const seedUsers = (): User[] => [
  { id: 1, full_name: 'Иванов Иван', email: 'ivanov@example.com', department: 'Продажи' },
  { id: 2, full_name: 'Петрова Анна', email: 'petrova@example.com', department: 'Разработка' },
  { id: 3, full_name: 'Сидоров Пётр', email: 'sidorov@example.com', department: 'Продажи' },
  { id: 4, full_name: 'Козлова Елена', email: 'kozlova@example.com', department: 'Маркетинг' },
]
