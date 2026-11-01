import type { z } from 'zod'
import { ApiError } from './errors'

/** Код для ответа, который не совпал с ожидаемой схемой (сервер ответил, но не тем форматом). */
export const BAD_RESPONSE = 502

/** Проверка ответа сервера схемой Zod: при несовпадении формата — понятная ошибка вместо падения страницы. */
export function parseResponse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error('Ответ сервера не совпал со схемой', result.error.issues)
    throw new ApiError(BAD_RESPONSE, 'Некорректный ответ сервера')
  }
  return result.data
}
