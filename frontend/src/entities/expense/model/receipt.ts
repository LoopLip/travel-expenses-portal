/** Ответ POST /receipts/recognize: предложение для формы расхода (расход сервер не создаёт). */
export interface ReceiptRecognition {
  receipt_url: string
  /** Сумма «0.00» или null, если не найдена. */
  amount: string | null
  /** Дата «YYYY-MM-DD» или null. */
  expense_date: string | null
  recognized: boolean
  message: string
}

/** Ответ GET /receipts/status: установлен ли Tesseract на сервере. */
export interface ReceiptStatus {
  available: boolean
  languages: string[]
}

export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_RECEIPT_MB = 5 // как MAX_RECEIPT_MB в backend; окончательно проверяет сервер (413)

/** Проверка файла до отправки: тип и размер. Возвращает текст ошибки или null. */
export function receiptFileError(file: { type: string; size: number }, maxMb = MAX_RECEIPT_MB): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return 'Выберите изображение JPEG, PNG или WEBP'
  if (file.size > maxMb * 1024 * 1024) return `Файл больше ${maxMb} МБ`
  return null
}

const STORED_RECEIPT = /^receipts\/[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/

/** Есть ли у расхода настоящий загруженный файл (старые демо-записи хранят только условное имя). */
export const hasStoredReceipt = (receiptUrl: string | null): boolean => receiptUrl !== null && STORED_RECEIPT.test(receiptUrl)
