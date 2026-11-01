type Listener = () => void

const listeners = new Set<Listener>()

/**
 * Шина «данные на сервере изменились». На неё подписан useQuery: после любой успешной мутации
 * все открытые запросы повторяются (инвалидация). Данные не кешируются, источник истины — сервер.
 */
export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyDataChanged(): void {
  listeners.forEach((l) => l())
}
