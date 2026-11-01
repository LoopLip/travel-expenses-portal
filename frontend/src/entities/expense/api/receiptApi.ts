import { http } from '@/shared/api'
import type { ReceiptRecognition, ReceiptStatus } from '../model/receipt'
import { toReceiptRecognition, toReceiptStatus } from './mappers'

/** Запросы распознавания и файлов чеков. Ничего в данных не меняют, поэтому без mutate/шины обновлений. */
export const receiptApi = {
  status: (signal?: AbortSignal): Promise<ReceiptStatus> => http.request<unknown>('/receipts/status', { signal }).then(toReceiptStatus),

  /** POST /receipts/recognize (multipart, поле file). Ошибки 413/415/422/503 приходят понятным текстом сервера. */
  recognize: (file: File): Promise<ReceiptRecognition> => {
    const form = new FormData()
    form.append('file', file)
    return http.request<unknown>('/receipts/recognize', { method: 'POST', formData: form }).then(toReceiptRecognition)
  },

  /** Файл чека расхода (с токеном, поэтому не обычной ссылкой). */
  download: (expenseId: number): Promise<Blob> => http.request<Blob>(`/expenses/${expenseId}/receipt`, { responseType: 'blob' }),
}
