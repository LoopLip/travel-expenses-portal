import type { ReceiptRecognition } from '@/entities/expense'

export type FillableField = 'amount' | 'expense_date'

export interface FieldState {
  /** Текущее значение поля формы. */
  value: string
  /** Значение, которое ранее подставили из чека (если подставляли). */
  filled?: string
}

/**
 * Какие поля подставить из результата распознавания. Правила:
 * - только найденные значения (null не трогает поле);
 * - только если человек не вводил значение сам: поле пустое или в нём всё ещё прошлая подстановка из чека.
 *   Вручную исправленную сумму новый чек не перезапишет.
 */
export function receiptValuesToFill(result: ReceiptRecognition, fields: Record<FillableField, FieldState>): Partial<Record<FillableField, string>> {
  const found: Record<FillableField, string | null> = { amount: result.amount, expense_date: result.expense_date }
  const out: Partial<Record<FillableField, string>> = {}
  for (const name of ['amount', 'expense_date'] as const) {
    const value = found[name]
    const { value: current, filled } = fields[name]
    const untouched = current.trim() === '' || (filled !== undefined && current === filled)
    if (value !== null && untouched) out[name] = value
  }
  return out
}
