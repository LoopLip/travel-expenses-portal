/** Деньги приходят из API строками («72000.00»). Считаем в копейках, чтобы не терять точность. */

/** До 10 цифр до точки и до 2 знаков после (как Numeric(12,2) в backend). */
export const MONEY_PATTERN = /^\d{1,10}([.,]\d{1,2})?$/

export function toKopecks(value: string | number): number {
  const s = String(value).trim().replace(',', '.')
  const [int, frac = ''] = s.split('.')
  return Number(int) * 100 + Number((frac + '00').slice(0, 2))
}

export function fromKopecks(kopecks: number): string {
  const sign = kopecks < 0 ? '-' : ''
  const abs = Math.abs(Math.round(kopecks))
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export const sumKopecks = (values: Array<string | number>): number => values.reduce<number>((s, v) => s + toKopecks(v), 0)

/** Нормализация ввода пользователя в формат API: «72000,5» → «72000.50». */
export const normalizeMoney = (value: string): string => fromKopecks(toKopecks(value))
