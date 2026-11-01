import { tripApi } from '@/entities/trip'

/** DELETE /trips/{id}: авансы и расходы сервер удаляет вместе с командировкой (ON DELETE CASCADE). */
export const deleteTrip = (tripId: number): Promise<void> => tripApi.remove(tripId)
