import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Alert, Button, Collapse, Grid, MenuItem, Stack } from '@mui/material'
import { categoryLabel, expenseApi, expenseCategories, expenseFormSchema, toExpenseUpdate } from '@/entities/expense'
import type { Expense, ExpenseFormValues, ReceiptRecognition } from '@/entities/expense'
import { applyServerErrors } from '@/shared/lib'
import { FormField, useNotify } from '@/shared/ui'
import { createExpense } from './createExpense'
import ReceiptUpload from './ReceiptUpload'
import { receiptValuesToFill } from './receiptFill'
import type { FillableField } from './receiptFill'

interface Props {
  trips: Array<{ id: number; label: string }>
  /** Командировка выбрана заранее (из карточки поездки). */
  tripId?: number
  /** Если задан — редактирование этого расхода (PATCH), иначе создание (POST). */
  expense?: Expense
  formId?: string
  /** Форма занята: идёт сохранение или распознавание чека (диалог блокирует кнопку «Сохранить»). */
  onSubmittingChange?: (v: boolean) => void
  onSaved: (expense: Expense) => void
  /** Если не задан — кнопки действий не рисуются (их показывает диалог). */
  onCancel?: () => void
}

const EXPENSE_FIELDS = ['trip_id', 'category', 'description', 'amount', 'expense_date'] as const
const FILLED_HINT = 'Подставлено из чека. Проверьте'

/**
 * Форма расхода: валидация zod и ошибки сервера у полей, распознавание суммы и даты по фото чека.
 * Расход не сохраняется автоматически: человек проверяет подставленные значения и нажимает «Сохранить».
 */
export default function ExpenseForm({ trips, tripId, expense, formId = 'expense-form', onSubmittingChange, onSaved, onCancel }: Props) {
  const notify = useNotify()
  const [receipt, setReceipt] = useState<string | null>(expense?.receipt_url ?? null)
  const [filled, setFilled] = useState<Partial<Record<FillableField, string>>>({})
  const [recognizing, setRecognizing] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, setValue, getValues, setError, formState } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    mode: 'onTouched',
    defaultValues: expense
      ? { trip_id: String(expense.trip_id), category: expense.category, description: expense.description, amount: expense.amount, expense_date: expense.expense_date }
      : { trip_id: tripId ? String(tripId) : '', category: 'transport', description: '', amount: '', expense_date: '' },
  })
  const [amount, expenseDate] = useWatch({ control, name: ['amount', 'expense_date'] })
  const busy = recognizing || formState.isSubmitting

  const setBusy = (value: boolean) => {
    setRecognizing(value)
    onSubmittingChange?.(value)
  }

  const applyRecognition = (result: ReceiptRecognition) => {
    setReceipt(result.receipt_url) // файл приложится к расходу при сохранении
    const values = receiptValuesToFill(result, {
      amount: { value: getValues('amount'), filled: filled.amount },
      expense_date: { value: getValues('expense_date'), filled: filled.expense_date },
    })
    for (const [name, value] of Object.entries(values) as Array<[FillableField, string]>) {
      setValue(name, value, { shouldValidate: true })
    }
    setFilled((prev) => ({ ...prev, ...values }))
  }

  const removeReceipt = () => {
    setReceipt(null)
    setFilled({}) // значения в полях остаются: человек мог их уже проверить
  }

  const submit = handleSubmit(async (values) => {
    if (recognizing) return // защита от отправки до окончания распознавания
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

  // Подсказка видна, пока в поле остаётся подставленное значение; после ручной правки исчезает
  const hint = (name: FillableField, current: string) => (filled[name] !== undefined && filled[name] === current ? FILLED_HINT : undefined)

  return (
    <form id={formId} onSubmit={submit} noValidate aria-label="Форма расхода">
      <ReceiptUpload attached={Boolean(receipt)} onBusyChange={setBusy} onRecognized={applyRecognition} onRemove={removeReceipt} />
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
          <FormField control={control} name="amount" label="Сумма, ₽" inputMode="decimal" hint={hint('amount', amount)} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormField control={control} name="expense_date" label="Дата" type="date" hint={hint('expense_date', expenseDate)} />
        </Grid>
      </Grid>
      <Collapse in={Boolean(serverError)}>
        <Alert severity="error" sx={{ mt: 2 }} data-testid="form-server-error">{serverError}</Alert>
      </Collapse>
      {onCancel && (
        <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
          <Button type="submit" variant="contained" disabled={busy}>
            {formState.isSubmitting ? 'Сохраняем…' : recognizing ? 'Распознаём чек…' : 'Сохранить'}
          </Button>
          <Button onClick={onCancel} disabled={formState.isSubmitting}>Отмена</Button>
        </Stack>
      )}
    </form>
  )
}
