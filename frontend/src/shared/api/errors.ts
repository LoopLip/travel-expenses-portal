export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const notFound = (label: string, id: number) => new ApiError(404, `${label} с id=${id} не найден(а)`)

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Неизвестная ошибка'
}
