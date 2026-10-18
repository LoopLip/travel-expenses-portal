import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material'
import { useState } from 'react'
import { tripFormSchema } from '@/entities/trip'
import type { Trip, TripFormValues } from '@/entities/trip'
import type { Budget } from '@/entities/budget'
import type { User } from '@/entities/user'
import { errorMessage } from '@/shared/api'
import { FormField, useNotify } from '@/shared/ui'
import { createTrip, updateTrip } from './saveTrip'

interface Props {
  trip?: Trip
  users: User[]
  budgets: Budget[]
  onSaved: (trip: Trip) => void
  onCancel: () => void
}

/** Форма создания и редактирования командировки с клиентской валидацией (zod). */
export default function TripForm({ trip, users, budgets, onSaved, onCancel }: Props) {
  const notify = useNotify()
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    mode: 'onTouched',
    defaultValues: {
      destination: trip?.destination ?? '',
      purpose: trip?.purpose ?? '',
      start_date: trip?.start_date ?? '',
      end_date: trip?.end_date ?? '',
      planned_amount: trip ? trip.planned_amount : '',
      user_id: trip ? String(trip.user_id) : '',
      budget_id: trip ? String(trip.budget_id) : '',
    },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      const saved = trip ? await updateTrip(trip.id, values) : await createTrip(values)
      notify(trip ? 'Командировка сохранена' : 'Командировка создана')
      onSaved(saved)
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label="Форма командировки">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="destination" label="Направление" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="user_id" label="Сотрудник" select disabled={Boolean(trip)}>
            {users.map((u) => <MenuItem key={u.id} value={String(u.id)}>{u.full_name}</MenuItem>)}
          </FormField>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="purpose" label="Цель поездки" multiline minRows={2} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormField control={control} name="start_date" label="Дата начала" type="date" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormField control={control} name="end_date" label="Дата окончания" type="date" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormField control={control} name="planned_amount" label="Плановая сумма, ₽" inputMode="decimal" />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="budget_id" label="Бюджет" select>
            {budgets.map((b) => <MenuItem key={b.id} value={String(b.id)}>{b.department} ({b.period})</MenuItem>)}
          </FormField>
        </Grid>
      </Grid>
      <Collapse in={Boolean(serverError)}>
        <Alert severity="error" sx={{ mt: 2 }} data-testid="form-server-error">{serverError}</Alert>
      </Collapse>
      <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
        <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Сохраняем…' : trip ? 'Сохранить' : 'Создать командировку'}
        </Button>
        <Button onClick={onCancel} disabled={formState.isSubmitting}>Отмена</Button>
      </Stack>
    </form>
  )
}
