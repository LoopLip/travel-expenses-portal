/**
 * Адрес backend: переменная VITE_API_URL (frontend/.env). Если она пустая — тот же хост, что у страницы, порт 8000.
 * Хост страницы и API должен совпадать (оба localhost или оба 127.0.0.1), иначе браузер не отправит cookie с refresh-токеном.
 */
export const API_URL: string =
  import.meta.env.VITE_API_URL || (typeof window === 'undefined' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`)

/** Максимальный limit списков в backend (Query(le=500)). Пагинации в интерфейсе нет — запрашиваем максимум. */
export const MAX_LIST_LIMIT = 500
