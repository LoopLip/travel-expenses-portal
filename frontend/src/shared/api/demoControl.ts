import { ApiError } from './errors'
import { notifyDataChanged } from './bus'

export interface DemoSettings {
  /** Все запросы завершаются ошибкой (чтобы показать состояние «ошибка»). */
  failRequests: boolean
  /** Долгие запросы (чтобы показать состояние «загрузка»). */
  slowNetwork: boolean
}

const KEY = 'demo:settings'
const DEFAULTS: DemoSettings = { failRequests: false, slowNetwork: false }

export function getDemoSettings(): DemoSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<DemoSettings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function setDemoSettings(patch: Partial<DemoSettings>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getDemoSettings(), ...patch }))
  } catch {
    /* localStorage недоступен — настройки не сохраняются */
  }
  notifyDataChanged()
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Имитация сетевого запроса: задержка и (по настройке) ошибка. Заменяется реальным fetch в ЛР №5. */
export async function simulateNetwork(): Promise<void> {
  const { failRequests, slowNetwork } = getDemoSettings()
  await sleep(slowNetwork ? 2500 : 250)
  if (failRequests) throw new ApiError(503, 'Сервер недоступен (демо-режим: имитация ошибки)')
}
