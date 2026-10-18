export const formatMoney = (n: number) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')
