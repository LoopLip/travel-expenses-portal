import { createCollection } from '@/shared/api'
import { todayIso } from '@/shared/lib'
import { seedAdvances } from '../model/seed'
import type { Advance, AdvanceCreate, AdvanceUpdate } from '../model/types'

const advances = createCollection<Advance>('advances', seedAdvances, 'Аванс')

export const advanceApi = {
  list: () => advances.list(),
  get: (id: number) => advances.get(id),
  create: (data: AdvanceCreate) =>
    advances.insert((id) => ({ ...data, id, status: 'requested', requested_at: todayIso() })),
  update: (id: number, changes: AdvanceUpdate) => advances.patch(id, changes),
  remove: (id: number) => advances.remove(id),
}
