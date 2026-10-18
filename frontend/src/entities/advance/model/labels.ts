import type { ChipColor } from '../../../shared/ui/StatusChip'
import type { AdvanceStatus } from './types'

export const advanceStatusLabel: Record<AdvanceStatus, { text: string; color: ChipColor }> = {
  requested: { text: 'Запрошен', color: 'warning' },
  issued: { text: 'Выдан', color: 'success' },
  settled: { text: 'Закрыт отчётом', color: 'info' },
}
