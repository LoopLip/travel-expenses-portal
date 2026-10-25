/** Адрес backend. По умолчанию — тот же хост, что у страницы, порт 8000 (так cookie остаётся «своим»). */
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? (typeof window === 'undefined' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`)
