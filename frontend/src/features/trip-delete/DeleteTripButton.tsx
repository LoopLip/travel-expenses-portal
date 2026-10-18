import type { Trip } from '@/entities/trip'
import { deleteTrip } from './deleteTrip'
import { ConfirmDeleteButton } from '@/shared/ui'

export default function DeleteTripButton({ trip, onDone }: { trip: Trip; onDone?: () => void }) {
  return (
    <ConfirmDeleteButton
      title="Удалить командировку?"
      text={`Командировка «${trip.destination}» будет удалена вместе с её авансами и расходами. Это действие нельзя отменить.`}
      successMessage="Командировка удалена"
      label="Удалить командировку"
      action={() => deleteTrip(trip.id)}
      onDone={onDone}
    />
  )
}
