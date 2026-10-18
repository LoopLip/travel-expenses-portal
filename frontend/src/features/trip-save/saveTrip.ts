import { advanceApi } from '@/entities/advance'
import { budgetApi } from '@/entities/budget'
import { tripApi } from '@/entities/trip'
import type { Trip, TripFormValues } from '@/entities/trip'
import { userApi } from '@/entities/user'
import { ApiError } from '@/shared/api'
import { normalizeMoney, sumKopecks, toKopecks } from '@/shared/lib'

const toPayload = (v: TripFormValues) => ({
  destination: v.destination.trim(),
  purpose: v.purpose,
  start_date: v.start_date,
  end_date: v.end_date,
  planned_amount: normalizeMoney(v.planned_amount),
})

/** POST /trips: как в backend, сначала проверяем, что сотрудник и бюджет существуют (404). */
export async function createTrip(values: TripFormValues): Promise<Trip> {
  const user_id = Number(values.user_id)
  const budget_id = Number(values.budget_id)
  await userApi.get(user_id)
  await budgetApi.get(budget_id)
  return tripApi.create({ ...toPayload(values), user_id, budget_id })
}

/** PATCH /trips/{id}: плановую сумму нельзя снизить ниже уже запрошенных авансов (400). */
export async function updateTrip(id: number, values: TripFormValues): Promise<Trip> {
  const budget_id = Number(values.budget_id)
  await budgetApi.get(budget_id)
  const advances = (await advanceApi.list()).filter((a) => a.trip_id === id)
  if (sumKopecks(advances.map((a) => a.amount)) > toKopecks(values.planned_amount)) {
    throw new ApiError(400, 'Плановая сумма не может быть меньше суммы авансов по командировке')
  }
  return tripApi.update(id, { ...toPayload(values), budget_id })
}
