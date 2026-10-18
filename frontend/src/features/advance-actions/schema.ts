import { moneyField, selectField, toKopecks, z } from '@/shared/lib'
import { advanceLimitError } from './requestAdvance'

export interface TripLimit {
  planned: number // копейки
  issued: number // копейки, уже запрошено
}

/** Схема формы аванса: формат суммы + проверка лимита выбранной командировки на клиенте. */
export const makeAdvanceFormSchema = (limits: Record<string, TripLimit>) =>
  z
    .object({ trip_id: selectField('командировка'), amount: moneyField(false) })
    .superRefine((v, ctx) => {
      const limit = limits[v.trip_id]
      if (!limit || v.amount.trim() === '' || !/^\d{1,10}([.,]\d{1,2})?$/.test(v.amount.trim())) return
      const error = advanceLimitError(limit.planned, limit.issued, toKopecks(v.amount))
      if (error) ctx.addIssue({ code: 'custom', path: ['amount'], message: error })
    })

export type AdvanceFormValues = z.infer<ReturnType<typeof makeAdvanceFormSchema>>
