import { parseResponse } from '@/shared/api'
import { apiDate, apiDateTime, apiId, apiMoney, normalizeMoney, z } from '@/shared/lib'
import { tripStatuses } from '../model/labels'
import type { TripFormValues } from '../model/schema'
import type { Trip, TripCreate, TripStatus, TripUpdate } from '../model/types'

/** Схема ответа TripOut. Лишние поля (например, advances и expenses у TripDetail) отбрасываются. */
const tripDto = z.object({
  id: apiId,
  destination: z.string(),
  purpose: z.string(),
  start_date: apiDate,
  end_date: apiDate,
  status: z.enum(tripStatuses as [TripStatus, ...TripStatus[]]),
  planned_amount: apiMoney,
  user_id: apiId,
  budget_id: apiId,
  created_at: apiDateTime,
})

// ---------- ответ сервера → модель интерфейса ----------
export const toTrip = (data: unknown): Trip => parseResponse(tripDto, data)
export const toTrips = (data: unknown): Trip[] => parseResponse(z.array(tripDto), data)

// ---------- значения формы → тело запроса ----------
const common = (v: TripFormValues) => ({
  destination: v.destination.trim(),
  purpose: v.purpose.trim(),
  start_date: v.start_date,
  end_date: v.end_date,
  planned_amount: normalizeMoney(v.planned_amount),
  budget_id: Number(v.budget_id),
})

/** withUser=false — поле user_id не отправляется, сервер оформит командировку на текущего пользователя. */
export const toTripCreate = (v: TripFormValues, withUser: boolean): TripCreate =>
  withUser && v.user_id ? { ...common(v), user_id: Number(v.user_id) } : common(v)

export const toTripUpdate = (v: TripFormValues): TripUpdate => common(v)
