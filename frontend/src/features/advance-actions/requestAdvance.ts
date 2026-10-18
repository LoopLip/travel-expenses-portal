import { advanceApi } from '@/entities/advance'
import type { Advance } from '@/entities/advance'
import { tripApi } from '@/entities/trip'
import { ApiError } from '@/shared/api'
import { formatMoney, fromKopecks, normalizeMoney, sumKopecks, toKopecks } from '@/shared/lib'

/**
 * Правило backend (crud._check_advance_limit): сумма авансов командировки не больше её плановой суммы.
 * Возвращает текст ошибки или null. Суммы — в копейках.
 */
export function advanceLimitError(plannedKopecks: number, othersKopecks: number, newKopecks: number): string | null {
  const total = othersKopecks + newKopecks
  if (total <= plannedKopecks) return null
  return `Сумма авансов (${formatMoney(fromKopecks(total))}) превышает плановую сумму командировки (${formatMoney(fromKopecks(plannedKopecks))})`
}

/** POST /advances: командировка должна существовать (404), лимит не превышен (400). */
export async function requestAdvance(tripId: number, amount: string): Promise<Advance> {
  const trip = await tripApi.get(tripId)
  const others = (await advanceApi.list()).filter((a) => a.trip_id === tripId)
  const error = advanceLimitError(toKopecks(trip.planned_amount), sumKopecks(others.map((a) => a.amount)), toKopecks(amount))
  if (error) throw new ApiError(400, error)
  return advanceApi.create({ trip_id: tripId, amount: normalizeMoney(amount) })
}
