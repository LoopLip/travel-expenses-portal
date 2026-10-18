import { advanceApi } from '@/entities/advance'
import { expenseApi } from '@/entities/expense'
import { tripApi } from '@/entities/trip'

/** Как в backend: авансы и расходы удаляются вместе с командировкой (ON DELETE CASCADE). */
export async function deleteTrip(tripId: number): Promise<void> {
  const [advances, expenses] = await Promise.all([advanceApi.list(), expenseApi.list()])
  await Promise.all([
    ...advances.filter((a) => a.trip_id === tripId).map((a) => advanceApi.remove(a.id)),
    ...expenses.filter((e) => e.trip_id === tripId).map((e) => expenseApi.remove(e.id)),
  ])
  await tripApi.remove(tripId)
}
