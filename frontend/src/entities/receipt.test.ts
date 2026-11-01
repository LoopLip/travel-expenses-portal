import { describe, expect, it, vi } from 'vitest'
import { hasStoredReceipt, receiptFileError, toReceiptRecognition, toReceiptStatus } from '@/entities/expense'

describe('ответ распознавания чека', () => {
  it('сумма приводится к «0.00», дата остаётся YYYY-MM-DD', () => {
    expect(
      toReceiptRecognition({ receipt_url: 'receipts/' + 'a'.repeat(32) + '.png', amount: '1234.5', expense_date: '2026-10-12', recognized: true, message: 'ok' }),
    ).toMatchObject({ amount: '1234.50', expense_date: '2026-10-12', recognized: true })
  })

  it('не найдено: null в сумме и дате допустим', () => {
    expect(toReceiptRecognition({ receipt_url: 'receipts/x.png', amount: null, expense_date: null, recognized: false, message: 'нет' })).toMatchObject({
      amount: null,
      expense_date: null,
      recognized: false,
    })
  })

  it('неверный формат ответа — «Некорректный ответ сервера»', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => toReceiptRecognition({ amount: 'много' })).toThrow('Некорректный ответ сервера')
    quiet.mockRestore()
  })

  it('статус OCR', () => {
    expect(toReceiptStatus({ available: false, languages: [] })).toEqual({ available: false, languages: [] })
  })
})

describe('проверка файла чека на клиенте', () => {
  it('принимает JPEG, PNG, WEBP до 5 МБ', () => {
    expect(receiptFileError({ type: 'image/jpeg', size: 1024 })).toBeNull()
    expect(receiptFileError({ type: 'image/webp', size: 5 * 1024 * 1024 })).toBeNull()
  })
  it('отклоняет другие типы и большие файлы', () => {
    expect(receiptFileError({ type: 'application/pdf', size: 10 })).toBe('Выберите изображение JPEG, PNG или WEBP')
    expect(receiptFileError({ type: 'image/gif', size: 10 })).toBe('Выберите изображение JPEG, PNG или WEBP')
    expect(receiptFileError({ type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('Файл больше 5 МБ')
  })
})

describe('есть ли у расхода настоящий файл чека', () => {
  it('только ссылки вида receipts/<uuid>.<ext>', () => {
    expect(hasStoredReceipt('receipts/' + '0f'.repeat(16) + '.jpg')).toBe(true)
    expect(hasStoredReceipt('receipts/check.png')).toBe(false) // условное имя из старых демо-данных
    expect(hasStoredReceipt('receipts/../../.env')).toBe(false)
    expect(hasStoredReceipt(null)).toBe(false)
  })
})
