import { describe, expect, it } from 'vitest'
import { toKopecks } from '@/shared/lib'
import { advanceLimitError, makeAdvanceFormSchema, requestAdvance } from '@/features/advance-actions'
import { advanceApi } from '@/entities/advance'
import { deleteTrip } from '@/features/trip-delete'
import { expenseApi } from '@/entities/expense'
import { tripApi } from '@/entities/trip'

describe('правило авансов: сумма авансов не больше плановой суммы', () => {
  it('advanceLimitError', () => {
    expect(advanceLimitError(7200000, 4000000, 3200000)).toBeNull()
    expect(advanceLimitError(7200000, 4000000, 4000000)).toMatch(/превышает плановую сумму командировки/)
  })
  it('схема формы проверяет лимит выбранной командировки', () => {
    const schema = makeAdvanceFormSchema({ '2': { planned: toKopecks('72000'), issued: toKopecks('40000') } })
    expect(schema.safeParse({ trip_id: '2', amount: '32000' }).success).toBe(true)
    const bad = schema.safeParse({ trip_id: '2', amount: '40000' })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0].path).toEqual(['amount'])
  })
})

describe('демо-API (без localStorage, данные в памяти)', () => {
  it('requestAdvance отклоняет аванс сверх лимита и принимает в пределах', async () => {
    await expect(requestAdvance(2, '40000')).rejects.toMatchObject({ status: 400 })
    const ok = await requestAdvance(2, '32000')
    expect(ok.amount).toBe('32000.00')
    expect(ok.status).toBe('requested')
  })
  it('requestAdvance для несуществующей командировки — 404', async () => {
    await expect(requestAdvance(999, '10')).rejects.toMatchObject({ status: 404 })
  })
  it('deleteTrip каскадно удаляет авансы и расходы', async () => {
    await deleteTrip(3)
    expect((await advanceApi.list()).some((a) => a.trip_id === 3)).toBe(false)
    expect((await expenseApi.list()).some((e) => e.trip_id === 3)).toBe(false)
    await expect(tripApi.get(3)).rejects.toMatchObject({ status: 404 })
  })
})
