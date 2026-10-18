import { notifyDataChanged } from './bus'
import { notFound } from './errors'
import { simulateNetwork } from './demoControl'

interface Stored<T> {
  items: T[]
  seq: number
}

export interface Collection<T extends { id: number }> {
  list(): Promise<T[]>
  get(id: number): Promise<T>
  insert(make: (id: number) => T): Promise<T>
  patch(id: number, changes: Partial<Omit<T, 'id'>>): Promise<T>
  remove(id: number): Promise<void>
}

interface Resettable {
  reset(): void
  clear(): void
}

const registry: Resettable[] = []

/** Демо-данные: вернуть исходный набор. */
export function resetDemoData(): void {
  registry.forEach((c) => c.reset())
  notifyDataChanged()
}

/** Демо-данные: удалить всё (чтобы показать состояние «нет данных»). */
export function clearDemoData(): void {
  registry.forEach((c) => c.clear())
  notifyDataChanged()
}

/**
 * Хранилище одной «таблицы» в памяти с сохранением в localStorage.
 * Хранятся только демонстрационные данные. Методы асинхронные, как будущие HTTP-запросы.
 */
export function createCollection<T extends { id: number }>(
  name: string,
  seed: () => T[],
  label: string,
): Collection<T> {
  const key = `demo:${name}`
  let state: Stored<T> | null = null

  const initial = (): Stored<T> => {
    const items = seed()
    return { items, seq: items.reduce((m, i) => Math.max(m, i.id), 0) }
  }
  const load = (): Stored<T> => {
    if (state) return state
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        state = JSON.parse(raw) as Stored<T>
        return state
      }
    } catch {
      /* повреждённые данные — используем исходные */
    }
    state = initial()
    return state
  }
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* не критично: данные останутся только в памяти */
    }
  }

  registry.push({
    reset: () => {
      state = initial()
      save()
    },
    clear: () => {
      state = { items: [], seq: 0 }
      save()
    },
  })

  return {
    async list() {
      await simulateNetwork()
      return load().items.map((i) => ({ ...i }))
    },
    async get(id) {
      await simulateNetwork()
      const found = load().items.find((i) => i.id === id)
      if (!found) throw notFound(label, id)
      return { ...found }
    },
    async insert(make) {
      await simulateNetwork()
      const s = load()
      s.seq += 1
      const item = make(s.seq)
      s.items.push(item)
      save()
      notifyDataChanged()
      return { ...item }
    },
    async patch(id, changes) {
      await simulateNetwork()
      const s = load()
      const idx = s.items.findIndex((i) => i.id === id)
      if (idx < 0) throw notFound(label, id)
      s.items[idx] = { ...s.items[idx], ...changes }
      save()
      notifyDataChanged()
      return { ...s.items[idx] }
    },
    async remove(id) {
      await simulateNetwork()
      const s = load()
      if (!s.items.some((i) => i.id === id)) throw notFound(label, id)
      s.items = s.items.filter((i) => i.id !== id)
      save()
      notifyDataChanged()
    },
  }
}
