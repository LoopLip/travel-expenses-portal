import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, Collapse, Grid } from '@mui/material'
import { budgetApi, budgetFormSchema, toBudgetPayload } from '@/entities/budget'
import type { Budget, BudgetFormValues } from '@/entities/budget'
import { applyServerErrors } from '@/shared/lib'
import { FormDialog, FormField, useNotify } from '@/shared/ui'

interface Props {
  open: boolean
  onClose: () => void
  /** Если задан — изменение бюджета (PATCH), иначе создание (POST). */
  budget?: Budget
}

const FORM_ID = 'budget-form'

/** Диалог бюджета отдела. Доступен руководителю и бухгалтеру; сервер проверяет право (403). */
export default function BudgetDialog({ open, onClose, budget }: Props) {
  const [submitting, setSubmitting] = useState(false)
  return (
    <FormDialog open={open} title={budget ? 'Изменить бюджет' : 'Новый бюджет'} submitLabel="Сохранить" submitting={submitting} onClose={onClose} formId={FORM_ID}>
      <BudgetForm budget={budget} setSubmitting={setSubmitting} onDone={onClose} />
    </FormDialog>
  )
}

function BudgetForm({ budget, setSubmitting, onDone }: { budget?: Budget; setSubmitting: (v: boolean) => void; onDone: () => void }) {
  const notify = useNotify()
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, setError } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    mode: 'onTouched',
    defaultValues: { department: budget?.department ?? '', period: budget?.period ?? '', limit_amount: budget?.limit_amount ?? '' },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    setSubmitting(true)
    try {
      if (budget) await budgetApi.update(budget.id, toBudgetPayload(values))
      else await budgetApi.create(toBudgetPayload(values))
      notify(budget ? 'Бюджет сохранён' : 'Бюджет создан')
      onDone()
    } catch (e) {
      setServerError(applyServerErrors(e, setError, ['department', 'period', 'limit_amount']))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate aria-label="Форма бюджета">
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 7 }}>
          <FormField control={control} name="department" label="Отдел" />
        </Grid>
        <Grid size={{ xs: 12, sm: 5 }}>
          <FormField control={control} name="period" label="Период" placeholder="2026-Q4" />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <FormField control={control} name="limit_amount" label="Лимит, ₽" inputMode="decimal" />
        </Grid>
      </Grid>
      <Collapse in={Boolean(serverError)}>
        <Alert severity="error" sx={{ mt: 2 }} data-testid="form-server-error">{serverError}</Alert>
      </Collapse>
    </form>
  )
}
