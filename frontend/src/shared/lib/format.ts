import { toKopecks } from './money'

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** Принимает строку из API («72000.00») или число. */
export const formatMoney = (value: string | number): string => rub.format(toKopecks(value) / 100)

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Дата из API. «YYYY-MM-DD» (даты поездок, расходов) — календарная дата без часового пояса: разбираем как местную,
 * иначе new Date('2026-12-01') означает полночь UTC и западнее Гринвича показывает 30.11.
 * Момент времени с поясом («…T11:28:40Z», created_at) показываем в местном времени.
 */
export function formatDate(iso: string): string {
  const m = DATE_ONLY.exec(iso)
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso)
  return date.toLocaleDateString('ru-RU')
}

/** Сегодняшняя дата в местном часовом поясе в формате API (YYYY-MM-DD). */
export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
