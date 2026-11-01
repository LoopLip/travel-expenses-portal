import { MAX_LIST_LIMIT, http, mutate } from '@/shared/api'
import type { Trip, TripCreate, TripListFilter, TripUpdate } from '../model/types'
import { toTrip, toTrips } from './mappers'

/** Запросы к /trips. Права проверяет сервер: сотрудник получает только свои командировки. */
export const tripApi = {
  list: (filter: TripListFilter = {}, signal?: AbortSignal): Promise<Trip[]> =>
    http.request<unknown>('/trips', { params: { ...filter, limit: MAX_LIST_LIMIT }, signal }).then(toTrips),
  get: (id: number, signal?: AbortSignal): Promise<Trip> => http.request<unknown>(`/trips/${id}`, { signal }).then(toTrip),
  create: (data: TripCreate): Promise<Trip> => mutate<unknown>('/trips', { method: 'POST', json: data }).then(toTrip),
  update: (id: number, changes: TripUpdate): Promise<Trip> =>
    mutate<unknown>(`/trips/${id}`, { method: 'PATCH', json: changes }).then(toTrip),
  /** Сервер удаляет вместе с командировкой её авансы и расходы (ON DELETE CASCADE). */
  remove: (id: number): Promise<void> => mutate<void>(`/trips/${id}`, { method: 'DELETE' }),
}
