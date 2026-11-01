import { describe, expect, it } from 'vitest'
import type { ReceiptRecognition } from '@/entities/expense'
import { receiptValuesToFill } from '@/features/expense-actions/receiptFill'

const result = (amount: string | null, expense_date: string | null): ReceiptRecognition => ({
  receipt_url: 'receipts/' + 'a'.repeat(32) + '.png',
  amount,
  expense_date,
  recognized: amount !== null || expense_date !== null,
  message: '',
})
const empty = { amount: { value: '' }, expense_date: { value: '' } }

describe('подстановка распознанных значений в форму расхода', () => {
  it('пустые поля заполняются найденными значениями', () => {
    expect(receiptValuesToFill(result('1234.50', '2026-10-12'), empty)).toEqual({ amount: '1234.50', expense_date: '2026-10-12' })
  })

  it('не найденное значение поле не трогает', () => {
    expect(receiptValuesToFill(result('780.00', null), empty)).toEqual({ amount: '780.00' })
    expect(receiptValuesToFill(result(null, null), empty)).toEqual({})
  })

  it('значение, введённое вручную, не перезаписывается', () => {
    const fields = { amount: { value: '500' }, expense_date: { value: '' } }
    expect(receiptValuesToFill(result('1234.50', '2026-10-12'), fields)).toEqual({ expense_date: '2026-10-12' })
  })

  it('прошлая подстановка из чека заменяется новым чеком, а исправленная вручную — нет', () => {
    const untouched = { amount: { value: '1234.50', filled: '1234.50' }, expense_date: { value: '2026-10-12', filled: '2026-10-12' } }
    expect(receiptValuesToFill(result('99.00', '2026-10-13'), untouched)).toEqual({ amount: '99.00', expense_date: '2026-10-13' })
    const corrected = { amount: { value: '1200.00', filled: '1234.50' }, expense_date: { value: '2026-10-12', filled: '2026-10-12' } }
    expect(receiptValuesToFill(result('99.00', '2026-10-13'), corrected)).toEqual({ expense_date: '2026-10-13' })
  })

  it('поле только из пробелов считается пустым', () => {
    expect(receiptValuesToFill(result('10.00', null), { amount: { value: '  ' }, expense_date: { value: '' } })).toEqual({ amount: '10.00' })
  })
})
