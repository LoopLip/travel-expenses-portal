import { advanceApi } from '@/entities/advance'
import type { Advance } from '@/entities/advance'
import { formatMoney, fromKopecks, normalizeMoney } from '@/shared/lib'

/**
 * Правило backend (crud._check_advance_limit): сумма авансов командировки не больше её плановой суммы.
 * Интерфейс проверяет его заранее для подсказки; окончательно решает сервер (400). Суммы — в копейках.
 */
export function advanceLimitError(plannedKopecks: number, othersKopecks: number, newKopecks: number): string | null {
  const total = othersKopecks + newKopecks
  if (total <= plannedKopecks) return null
  return `Сумма авансов (${formatMoney(fromKopecks(total))}) превышает плановую сумму командировки (${formatMoney(fromKopecks(plannedKopecks))})`
}

/** POST /advances. Командировка должна быть доступна (404), лимит не превышен (400). */
export const requestAdvance = (tripId: number, amount: string): Promise<Advance> =>
  advanceApi.create({ trip_id: tripId, amount: normalizeMoney(amount) })
