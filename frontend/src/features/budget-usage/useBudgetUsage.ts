import { useQuery } from '@/shared/lib'
import { loadBudgetUsage } from './usage'

/** Использование бюджетов; загружается заново после любых изменений (командировки меняют резерв). */
export const useBudgetUsage = () => useQuery((signal) => loadBudgetUsage(signal))
