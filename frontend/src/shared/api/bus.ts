type Listener = () => void

const listeners = new Set<Listener>()
let revision = 0

/** Подписка на любые изменения демо-данных (используется useQuery для обновления списков). */
export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyDataChanged(): void {
  revision += 1
  listeners.forEach((l) => l())
}

export const getRevision = () => revision
