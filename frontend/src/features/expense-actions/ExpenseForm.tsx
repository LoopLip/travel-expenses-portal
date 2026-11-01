import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { categoryLabel, expenseApi, expenseCategories, expenseFormSchema, toExpenseUpdate } from '@/entities/expense'
import type { Expense, ExpenseFormValues } from '@/entities/expense'
import { applyServerErrors } from '@/shared/lib'
import { FormField, useNotify } from '@/shared/ui'
import { DEMO_RECOGNIZED, createExpense } from './createExpense'

interface Props {
  trips: Array<{ id: number; label: string }>
  /** Командировка выбрана заранее (из карточки поездки). */
  tripId?: number
  /** Если задан — редактирование этого расхода (PATCH), иначе создание (POST). */
  expense?: Expense
  formId?: string
  onSubmittingChange?: (v: boolean) => void
  onSaved: (expense: Expense) => void
  /** Если не задан — кнопки действий не рисуются (их показывает диалог). */
  onCancel?: () => void
}

const EXPENSE_FIELDS = ['trip_id', 'category', 'description', 'amount', 'expense_date'] as const

/** Форма расхода: валидация zod и ошибки сервера у полей, предзаполнение суммы и даты по «фото чека» (имитация). */
export default function ExpenseForm({ trips, tripId, expense, formId = 'expense-form', onSubmittingChange, onSaved, onCancel }: Props) {
  const notify = useNotify()
  const [receipt, setReceipt] = useState<string | null>(expense?.receipt_url ?? null)
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, setValue, setError, formState } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    mode: 'onTouched',
    defaultValues: expense
      ? { trip_id: String(expense.trip_id), category: expense.category, description: expense.description, amount: expense.amount, expense_date: expense.expense_date }
      : { trip_id: tripId ? String(tripId) : '', category: 'transport', description: '', amount: '', expense_date: '' },
  })

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceipt(`receipts/${file.name}`)
    setValue('amount', DEMO_RECOGNIZED.amount, { shouldValidate: true })
    setValue('expense_date', DEMO_RECOGNIZED.date, { shouldValidate: true })
  }

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    onSubmittingChange?.(true)
    try {
      const saved = expense ? await expenseApi.update(expense.id, toExpenseUpdate(values, receipt)) : await createExpense(values, receipt)
      notify(expense ? 'Расход сохранён' : 'Расход добавлен')
      onSaved(saved)
    } catch (e) {
      setServerError(applyServerErrors(e, setError, EXPENSE_FIELDS))
    } finally {
      onSubmittingChange?.(false)
    }
  })

  return (
    <form id={formId} onSubmit={submit} noValidate aria-label="Форма расхода">
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ alignSelf: 'flex-start' }}>
          Загрузить фото чека
          <input hidden type="file" accept="image/*" onChange={onFile} />
        </Button>
        <Collapse in={Boolean(receipt)}>
          <Alert severity="info">
            Файл «{receipt?.replace('receipts/', '')}» обработан (демо-режим). Проверьте распознанные значения перед сохранением.
          </Alert>
        </Collapse>
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="trip_id" label="Командировка" select disabled={Boolean(tripId || expense)}>
            {trips.map((t) => <MenuItem key={t.id} value={String(t.id)}>{t.label}</MenuItem>)}
          </FormField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="category" label="Категория" select>
            {expenseCategories.map((c) => <MenuItem key={c} value={c}>{categoryLabel[c]}</MenuItem>)}
          </FormField>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="description" label="Описание" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="amount" label="Сумма, ₽" inputMode="decimal" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="expense_date" label="Дата" type="date" />
        </Grid>
      </Grid>
      <Collapse in={Boolean(serverError)}>
        <Alert severity="error" sx={{ mt: 2 }} data-testid="form-server-error">{serverError}</Alert>
      </Collapse>
      {onCancel && (
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? 'Сохраняем…' : 'Сохранить'}
          </Button>
          <Button onClick={onCancel} disabled={formState.isSubmitting}>Отмена</Button>
        </Stack>
      )}
    </form>
  )
}
