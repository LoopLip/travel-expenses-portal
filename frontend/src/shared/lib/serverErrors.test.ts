import { describe, expect, it, vi } from 'vitest'
import { ApiError, VALIDATION_MESSAGE, networkError } from '../api'
import { applyServerErrors } from './serverErrors'

type Values = { destination: string; planned_amount: string }
const FIELDS = ['destination', 'planned_amount'] as const

describe('ошибки сервера в форме', () => {
  it('422 по полям формы: ставятся под поля, общего сообщения нет', () => {
    const setError = vi.fn()
    const error = new ApiError(422, VALIDATION_MESSAGE, { destination: 'Поле не может быть пустым', planned_amount: 'Не более 2 знаков после запятой' })
    expect(applyServerErrors<Values>(error, setError, FIELDS)).toBeNull()
    expect(setError).toHaveBeenCalledWith('destination', { type: 'server', message: 'Поле не может быть пустым' }, { shouldFocus: true })
    expect(setError).toHaveBeenCalledTimes(2)
  })

  it('422 с ошибкой всей модели: поля + общее сообщение', () => {
    const setError = vi.fn()
    const error = new ApiError(422, 'Дата окончания не может быть раньше даты начала', { destination: 'Поле не может быть пустым' })
    expect(applyServerErrors<Values>(error, setError, FIELDS)).toBe('Дата окончания не может быть раньше даты начала')
  })

  it('422 по полю, которого нет в форме: показываем общее сообщение', () => {
    const setError = vi.fn()
    expect(applyServerErrors<Values>(new ApiError(422, VALIDATION_MESSAGE, { budget_id: 'Обязательное поле' }), setError, FIELDS)).toBe(VALIDATION_MESSAGE)
    expect(setError).not.toHaveBeenCalled()
  })

  it('400, 403, 409 и ошибка сети — общим сообщением без отметок у полей', () => {
    const setError = vi.fn()
    expect(applyServerErrors<Values>(new ApiError(400, 'Плановая сумма не может быть меньше суммы авансов по командировке'), setError, FIELDS)).toMatch(/Плановая сумма/)
    expect(applyServerErrors<Values>(new ApiError(403, 'Недостаточно прав для этого действия'), setError, FIELDS)).toBe('Недостаточно прав для этого действия')
    expect(applyServerErrors<Values>(networkError(), setError, FIELDS)).toMatch(/Нет связи с сервером/)
    expect(setError).not.toHaveBeenCalled()
  })
})
