import type { ExpenseCategory } from './types'

export const categoryLabel: Record<ExpenseCategory, string> = {
  transport: 'Транспорт',
  lodging: 'Проживание',
  meals: 'Питание',
  other: 'Прочее',
}
