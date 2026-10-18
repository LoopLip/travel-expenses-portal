import { useState } from 'react'
import { tripApi } from '@/entities/trip'
import { useQuery } from '@/shared/lib'
import { ErrorState, FormDialog, LoadingState } from '@/shared/ui'
import ExpenseForm from './ExpenseForm'

interface Props {
  open: boolean
  onClose: () => void
  tripId?: number
}

/** Диалог «Добавить расход» (из карточки командировки или списка расходов). */
export default function ExpenseDialog({ open, onClose, tripId }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const trips = useQuery(() => tripApi.list())
  return (
    <FormDialog open={open} title="Добавить расход" submitLabel="Сохранить" submitting={submitting} onClose={onClose} formId="expense-dialog-form">
      {trips.error && <ErrorState message={trips.error} onRetry={trips.reload} />}
      {!trips.error && !trips.data && <LoadingState rows={3} />}
      {!trips.error && trips.data && (
        <ExpenseForm
          key={String(open)}
          formId="expense-dialog-form"
          trips={trips.data.map((t) => ({ id: t.id, label: t.destination }))}
          tripId={tripId}
          onSubmittingChange={setSubmitting}
          onSaved={onClose}
        />
      )}
    </FormDialog>
  )
}
