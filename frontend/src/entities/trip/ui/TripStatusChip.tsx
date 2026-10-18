import { StatusChip } from '@/shared/ui'
import { tripStatusLabel } from '../model/labels'
import type { TripStatus } from '../model/types'

export default function TripStatusChip({ status }: { status: TripStatus }) {
  return <StatusChip {...tripStatusLabel[status]} />
}
