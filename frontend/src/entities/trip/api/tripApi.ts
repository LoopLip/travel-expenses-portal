import { createCollection } from '@/shared/api'
import { seedTrips } from '../model/seed'
import type { Trip, TripCreate, TripUpdate } from '../model/types'

const trips = createCollection<Trip>('trips', seedTrips, 'Командировка')

/** Сырые операции с командировками (как эндпоинты /trips). Правила и связи проверяют features. */
export const tripApi = {
  list: () => trips.list(),
  get: (id: number) => trips.get(id),
  create: (data: TripCreate) =>
    trips.insert((id) => ({ ...data, id, status: 'draft', created_at: new Date().toISOString() })),
  update: (id: number, changes: TripUpdate) => trips.patch(id, changes),
  remove: (id: number) => trips.remove(id),
}
