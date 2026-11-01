import { describe, expect, it } from 'vitest'
import { toKopecks } from '@/shared/lib'
import { advanceLimitError, makeAdvanceFormSchema } from '@/features/advance-actions'

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
