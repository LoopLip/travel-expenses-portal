import type { Trip, TripStatus } from '@/entities/trip'
import type { User } from '@/entities/user'

export interface TripFilterState {
  search: string
  status: 'all' | TripStatus
}

export const initialTripFilter: TripFilterState = { search: '', status: 'all' }

/** Фильтр списка командировок: статус + поиск по направлению, цели и ФИО сотрудника. */
export function applyTripFilter(trips: Trip[], users: User[], filter: TripFilterState): Trip[] {
  const q = filter.search.trim().toLowerCase()
  const names = new Map(users.map((u) => [u.id, u.full_name.toLowerCase()]))
  return trips.filter((t) => {
    if (filter.status !== 'all' && t.status !== filter.status) return false
    if (!q) return true
    return [t.destination, t.purpose, names.get(t.user_id) ?? ''].some((s) => s.toLowerCase().includes(q))
  })
}
