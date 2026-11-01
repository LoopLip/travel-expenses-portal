import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, VALIDATION_MESSAGE, errorMessage } from '../api'

/**
 * Ошибку сервера показывает форма. Ошибки валидации 422 по полям (loc: ["body", "<поле>"]) ставятся под эти поля,
 * как и клиентские ошибки. Возвращает текст для общего сообщения под формой или null, если всё разложено по полям.
 * Поля формы называются так же, как поля тела запроса (destination, amount…), поэтому сопоставление прямое.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): string | null {
  if (!(error instanceof ApiError) || error.status !== 422) return errorMessage(error)
  let unplaced = false
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) setError(field as Path<T>, { type: 'server', message }, { shouldFocus: true })
    else unplaced = true
  }
  const placedAll = Object.keys(error.fieldErrors).length > 0 && !unplaced
  return placedAll && error.message === VALIDATION_MESSAGE ? null : error.message
}
