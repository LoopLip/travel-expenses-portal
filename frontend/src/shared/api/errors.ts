/** Статус «нет ответа сервера» (сеть, CORS, backend не запущен): HTTP-кода нет. */
export const NETWORK_ERROR = 0

export class ApiError extends Error {
  readonly status: number
  /** Ошибки валидации сервера (422) по полям: имя поля → сообщение на русском. */
  readonly fieldErrors: Readonly<Record<string, string>>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export const networkError = () => new ApiError(NETWORK_ERROR, 'Нет связи с сервером. Проверьте подключение и что backend запущен.')

export const isAbortError = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError'

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка'
}

/** Общий текст ошибки 422, когда все замечания относятся к конкретным полям формы. */
export const VALIDATION_MESSAGE = 'Проверьте правильность введённых данных'
