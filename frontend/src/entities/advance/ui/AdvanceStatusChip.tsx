import { StatusChip } from '@/shared/ui'
import { advanceStatusLabel } from '../model/labels'
import type { AdvanceStatus } from '../model/types'

export default function AdvanceStatusChip({ status }: { status: AdvanceStatus }) {
  return <StatusChip {...advanceStatusLabel[status]} />
}
