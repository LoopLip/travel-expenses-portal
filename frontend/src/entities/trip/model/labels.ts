import type { ChipColor } from '../../../shared/ui/StatusChip'
import type { TripStatus } from './types'

export const tripStatusLabel: Record<TripStatus, { text: string; color: ChipColor }> = {
  draft: { text: 'Черновик', color: 'default' },
  pending: { text: 'На согласовании', color: 'warning' },
  approved: { text: 'Согласована', color: 'success' },
  rejected: { text: 'Отклонена', color: 'error' },
  completed: { text: 'Завершена', color: 'info' },
}
