export type AdvanceStatus = 'requested' | 'issued' | 'settled'

/** Аванс (ответ AdvanceOut). Дату запроса ставит сервер. */
export interface Advance {
  id: number
  trip_id: number
  amount: string
  status: AdvanceStatus
  requested_at: string
}

export interface AdvanceCreate {
  trip_id: number
  amount: string
}

/** Сумму может менять любой, кому виден аванс; статус — только бухгалтер (permissions.py). */
export type AdvanceUpdate = Partial<{ amount: string; status: AdvanceStatus }>

/** Фильтры GET /advances. */
export interface AdvanceListFilter {
  trip_id?: number
  status?: AdvanceStatus
}
