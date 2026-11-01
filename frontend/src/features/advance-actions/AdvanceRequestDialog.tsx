import { useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Alert, Collapse, Grid, MenuItem } from '@mui/material'
import { advanceApi } from '@/entities/advance'
import type { Advance } from '@/entities/advance'
import { tripApi } from '@/entities/trip'
import { applyServerErrors, formatMoney, fromKopecks, normalizeMoney, sumKopecks, toKopecks, useQuery } from '@/shared/lib'
import { ErrorState, FormDialog, FormField, LoadingState, useNotify } from '@/shared/ui'
import { requestAdvance } from './requestAdvance'
import { makeAdvanceFormSchema } from './schema'
import type { AdvanceFormValues, TripLimit } from './schema'

interface Props {
  open: boolean
  onClose: () => void
  /** Если задан — командировка выбрана заранее (из карточки поездки). */
  tripId?: number
  /** Если задан — изменение суммы этого аванса (PATCH), иначе запрос нового (POST). */
  advance?: Advance
}

const FORM_ID = 'advance-request-form'

/** Диалог «Запросить аванс» / «Изменить аванс»: валидация формата и лимита, блокировка кнопки, уведомление. */
export default function AdvanceRequestDialog({ open, onClose, tripId, advance }: Props) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <FormDialog
      open={open}
      title={advance ? 'Изменить аванс' : 'Запросить аванс'}
      submitLabel={advance ? 'Сохранить' : 'Запросить'}
      submitting={submitting}
      onClose={onClose}
      formId={FORM_ID}
    >
      {/* Содержимое (и запросы данных) существует только пока диалог открыт */}
      <AdvanceDialogBody tripId={advance?.trip_id ?? tripId} advance={advance} setSubmitting={setSubmitting} onDone={onClose} />
    </FormDialog>
  )
}

interface BodyProps {
  tripId?: number
  advance?: Advance
  setSubmitting: (v: boolean) => void
  onDone: () => void
}

function AdvanceDialogBody({ tripId, advance, setSubmitting, onDone }: BodyProps) {
  const data = useQuery(async (signal) => {
    const [trips, advances] = await Promise.all([tripApi.list({}, signal), advanceApi.list(tripId ? { trip_id: tripId } : {}, signal)])
    return { trips, advances }
  }, [tripId])

  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />
  if (!data.data) return <LoadingState rows={2} />
  // При изменении сам аванс не входит в «уже запрошено»: лимит считается для новой суммы вместо старой
  const others = data.data.advances.filter((a) => a.id !== advance?.id)
  return (
    <AdvanceForm
      trips={data.data.trips.map((t) => ({ id: t.id, label: t.destination, planned: t.planned_amount }))}
      issuedByTrip={others.reduce<Record<number, string[]>>((m, a) => ({ ...m, [a.trip_id]: [...(m[a.trip_id] ?? []), a.amount] }), {})}
      tripId={tripId}
      advance={advance}
      setSubmitting={setSubmitting}
      onDone={onDone}
    />
  )
}

interface FormProps {
  trips: Array<{ id: number; label: string; planned: string }>
  issuedByTrip: Record<number, string[]>
  tripId?: number
  advance?: Advance
  setSubmitting: (v: boolean) => void
  onDone: () => void
}

function AdvanceForm({ trips, issuedByTrip, tripId, advance, setSubmitting, onDone }: FormProps) {
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

  const { control, handleSubmit, setError } = useForm<AdvanceFormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { trip_id: tripId ? String(tripId) : '', amount: advance ? advance.amount : '' },
  })
  const selected = limits[useWatch({ control, name: 'trip_id' })]
  const available = selected ? formatMoney(fromKopecks(Math.max(0, selected.planned - selected.issued))) : undefined

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      if (advance) {
        await advanceApi.update(advance.id, { amount: normalizeMoney(values.amount) })
        notify('Аванс изменён')
      } else {
        await requestAdvance(Number(values.trip_id), values.amount.trim())
        notify('Аванс запрошен')
      }
      onDone()
    } catch (e) {
      setServerError(applyServerErrors(e, setError, ['trip_id', 'amount']))
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
