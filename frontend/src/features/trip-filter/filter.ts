import type { TripListFilter, TripStatus } from '@/entities/trip'

export interface TripFilterState {
  search: string
  status: 'all' | TripStatus
}

export const initialTripFilter: TripFilterState = { search: '', status: 'all' }

/** Состояние фильтра → параметры GET /trips: отбор по статусу и поиск выполняет сервер. */
export function toTripListFilter(filter: TripFilterState): TripListFilter {
  const q = filter.search.trim()
  return {
    status: filter.status === 'all' ? undefined : filter.status,
    q: q || undefined,
  }
}

export const isFilterActive = (filter: TripFilterState): boolean => filter.status !== 'all' || filter.search.trim() !== ''
