import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Alert, Collapse, Grid, MenuItem } from '@mui/material'
import { advanceApi } from '@/entities/advance'
import { tripApi } from '@/entities/trip'
import { errorMessage } from '@/shared/api'
import { formatMoney, fromKopecks, sumKopecks, toKopecks, useQuery } from '@/shared/lib'
import { ErrorState, FormDialog, FormField, LoadingState, useNotify } from '@/shared/ui'
import { requestAdvance } from './requestAdvance'
import { makeAdvanceFormSchema } from './schema'
import type { AdvanceFormValues, TripLimit } from './schema'

interface Props {
  open: boolean
  onClose: () => void
  /** Если задан — командировка выбрана заранее (из карточки поездки). */
  tripId?: number
}

const FORM_ID = 'advance-request-form'

/** Диалог «Запросить аванс»: валидация формата и лимита, блокировка кнопки, уведомление. */
export default function AdvanceRequestDialog({ open, onClose, tripId }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const data = useQuery(async () => {
    const [trips, advances] = await Promise.all([tripApi.list(), advanceApi.list()])
    return { trips, advances }
  })

  return (
    <FormDialog open={open} title="Запросить аванс" submitLabel="Запросить" submitting={submitting} onClose={onClose} formId={FORM_ID}>
      {data.error && <ErrorState message={data.error} onRetry={data.reload} />}
      {!data.error && (data.loading || !data.data) && <LoadingState rows={2} />}
      {!data.error && data.data && (
        <AdvanceForm
          key={String(open)}
          trips={data.data.trips.map((t) => ({ id: t.id, label: t.destination, planned: t.planned_amount }))}
          issuedByTrip={data.data.advances.reduce<Record<number, string[]>>((m, a) => ({ ...m, [a.trip_id]: [...(m[a.trip_id] ?? []), a.amount] }), {})}
          tripId={tripId}
          setSubmitting={setSubmitting}
          onDone={onClose}
        />
      )}
    </FormDialog>
  )
}

interface FormProps {
  trips: Array<{ id: number; label: string; planned: string }>
  issuedByTrip: Record<number, string[]>
  tripId?: number
  setSubmitting: (v: boolean) => void
  onDone: () => void
}

function AdvanceForm({ trips, issuedByTrip, tripId, setSubmitting, onDone }: FormProps) {
  const notify = useNotify()
  const [serverError, setServerError] = useState<string | null>(null)
  const limits = useMemo(() => {
    const m: Record<string, TripLimit> = {}
    trips.forEach((t) => {
      m[String(t.id)] = { planned: toKopecks(t.planned), issued: sumKopecks(issuedByTrip[t.id] ?? []) }
    })
    return m
  }, [trips, issuedByTrip])
  const schema = useMemo(() => makeAdvanceFormSchema(limits), [limits])

  const { control, handleSubmit } = useForm<AdvanceFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { trip_id: tripId ? String(tripId) : '', amount: '' },
  })
  const selected = limits[useWatch({ control, name: 'trip_id' })]
  const available = selected ? formatMoney(fromKopecks(Math.max(0, selected.planned - selected.issued))) : undefined

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      await requestAdvance(Number(values.trip_id), values.amount.trim())
      notify('Аванс запрошен')
      onDone()
    } catch (e) {
      setServerError(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate aria-label="Форма аванса">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="trip_id" label="Командировка" select disabled={Boolean(tripId)}>
            {trips.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.label}</MenuItem>)}
          </FormField>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="amount" label="Сумма аванса, ₽" inputMode="decimal" hint={available ? `Доступно в рамках плановой суммы: ${available}` : undefined} />
        </Grid>
      </Grid>
      <Collapse in={Boolean(serverError)}>
        <Alert severity="error" sx={{ mt: 2 }} data-testid="form-server-error">{serverError}</Alert>
      </Collapse>
    </form>
  )
}
