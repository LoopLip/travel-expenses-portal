import { parseResponse } from '@/shared/api'
import { apiDate, apiId, apiMoney, z } from '@/shared/lib'
import { advanceStatuses } from '../model/labels'
import type { Advance, AdvanceStatus } from '../model/types'

const advanceDto = z.object({
  id: apiId,
  trip_id: apiId,
  amount: apiMoney,
  status: z.enum(advanceStatuses as [AdvanceStatus, ...AdvanceStatus[]]),
  requested_at: apiDate,
})

export const toAdvance = (data: unknown): Advance => parseResponse(advanceDto, data)
export const toAdvances = (data: unknown): Advance[] => parseResponse(z.array(advanceDto), data)
