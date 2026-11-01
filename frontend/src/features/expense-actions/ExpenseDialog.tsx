import { useState } from 'react'
import type { Expense } from '@/entities/expense'
import { tripApi } from '@/entities/trip'
import { useQuery } from '@/shared/lib'
import { ErrorState, FormDialog, LoadingState } from '@/shared/ui'
import ExpenseForm from './ExpenseForm'

interface Props {
  open: boolean
  onClose: () => void
  tripId?: number
  /** Если задан — диалог изменения этого расхода. */
  expense?: Expense
}

const FORM_ID = 'expense-dialog-form'

/** Диалог «Добавить расход» / «Изменить расход» (из карточки командировки или списка расходов). */
export default function ExpenseDialog({ open, onClose, tripId, expense }: Props) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <FormDialog open={open} title={expense ? 'Изменить расход' : 'Добавить расход'} submitLabel="Сохранить" submitting={submitting} onClose={onClose} formId={FORM_ID}>
      {/* Содержимое (и запрос списка командировок) существует только пока диалог открыт */}
      <ExpenseDialogBody tripId={tripId} expense={expense} setSubmitting={setSubmitting} onSaved={onClose} />
    </FormDialog>
  )
}

function ExpenseDialogBody({ tripId, expense, setSubmitting, onSaved }: { tripId?: number; expense?: Expense; setSubmitting: (v: boolean) => void; onSaved: () => void }) {
  const trips = useQuery((signal) => tripApi.list({}, signal))
  if (trips.error) return <ErrorState message={trips.error} onRetry={trips.reload} />
  if (!trips.data) return <LoadingState rows={3} />
  return (
    <ExpenseForm
      formId={FORM_ID}
      trips={trips.data.map((t) => ({ id: t.id, label: t.destination }))}
      tripId={tripId}
      expense={expense}
      onSubmittingChange={setSubmitting}
      onSaved={onSaved}
    />
  )
}
