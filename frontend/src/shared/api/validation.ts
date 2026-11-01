/** Элемент списка ошибок валидации FastAPI/Pydantic (ответ 422: {"detail": [...]}). */
export interface ValidationItem {
  type: string
  loc: Array<string | number>
  msg: string
  ctx?: Record<string, unknown>
}

export interface TranslatedValidation {
  /** Ошибки конкретных полей тела запроса: имя поля → сообщение. */
  fieldErrors: Record<string, string>
  /** Ошибки без поля (проверка всей модели, параметры адреса). */
  formErrors: string[]
}

const num = (v: unknown) => (typeof v === 'number' || typeof v === 'string' ? String(v) : '')

/** Перевод сообщений Pydantic (на английском) на русский по типу ошибки. Неизвестный тип — исходный текст. */
export function translateItem({ type, msg, ctx = {} }: ValidationItem): string {
  switch (type) {
    case 'missing':
      return 'Обязательное поле'
    case 'string_too_short':
      return Number(ctx.min_length) <= 1 ? 'Поле не может быть пустым' : `Не короче ${num(ctx.min_length)} символов`
    case 'string_too_long':
      return `Не более ${num(ctx.max_length)} символов`
    case 'string_pattern_mismatch':
      return 'Неверный формат'
    case 'greater_than':
      return Number(ctx.gt) === 0 ? 'Значение должно быть больше нуля' : `Значение должно быть больше ${num(ctx.gt)}`
    case 'greater_than_equal':
      return Number(ctx.ge) === 0 ? 'Значение не может быть отрицательным' : `Значение должно быть не меньше ${num(ctx.ge)}`
    case 'less_than_equal':
      return `Значение должно быть не больше ${num(ctx.le)}`
    case 'decimal_max_places':
      return `Не более ${num(ctx.decimal_places)} знаков после запятой`
    case 'decimal_max_digits':
    case 'decimal_whole_digits':
      return 'Слишком большое число'
    case 'decimal_parsing':
    case 'float_parsing':
      return 'Введите число'
    case 'int_parsing':
    case 'int_type':
      return 'Введите целое число'
    case 'date_parsing':
    case 'date_from_datetime_parsing':
    case 'date_type':
      return 'Некорректная дата'
    case 'enum':
      return 'Недопустимое значение'
    case 'value_error': {
      const text = msg.replace(/^Value error,\s*/, '')
      return text.charAt(0).toUpperCase() + text.slice(1)
    }
    default:
      return msg
  }
}

/** Раскладывает список ошибок 422 на ошибки полей (loc: ["body", "<поле>"]) и общие ошибки. */
export function translateValidation(items: ValidationItem[]): TranslatedValidation {
  const fieldErrors: Record<string, string> = {}
  const formErrors: string[] = []
  for (const item of items) {
    const text = translateItem(item)
    const field = item.loc[0] === 'body' && item.loc.length > 1 ? String(item.loc[1]) : null
    if (field && !(field in fieldErrors)) fieldErrors[field] = text
    else if (!field) formErrors.push(text)
  }
  return { fieldErrors, formErrors }
}

export const isValidationList = (detail: unknown): detail is ValidationItem[] =>
  Array.isArray(detail) && detail.every((d) => typeof d === 'object' && d !== null && 'type' in d && 'loc' in d && 'msg' in d)
