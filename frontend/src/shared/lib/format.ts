import { toKopecks } from './money'

const rub = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0 })

/** Принимает строку из API («72000.00») или число. */
export const formatMoney = (value: string | number): string => rub.format(toKopecks(value) / 100)

export const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('ru-RU')

export const todayIso = (): string => new Date().toISOString().slice(0, 10)
