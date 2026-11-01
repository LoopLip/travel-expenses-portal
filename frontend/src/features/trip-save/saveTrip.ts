import { toTripCreate, toTripUpdate, tripApi } from '@/entities/trip'
import type { Trip, TripFormValues } from '@/entities/trip'

/**
 * POST /trips. chooseEmployee=true (руководитель) — командировка оформляется на выбранного сотрудника,
 * иначе поле user_id не отправляется и сервер оформляет её на текущего пользователя.
 * Существование бюджета и сотрудника проверяет сервер (404).
 */
export const createTrip = (values: TripFormValues, chooseEmployee: boolean): Promise<Trip> =>
  tripApi.create(toTripCreate(values, chooseEmployee))

/** PATCH /trips/{id}: плановую сумму нельзя снизить ниже уже запрошенных авансов — сервер ответит 400. */
export const updateTrip = (id: number, values: TripFormValues): Promise<Trip> => tripApi.update(id, toTripUpdate(values))
