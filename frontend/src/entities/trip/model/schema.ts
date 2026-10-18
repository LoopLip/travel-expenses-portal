import { dateField, moneyField, selectField, textField, z } from '@/shared/lib'

export const tripFormSchema = z
  .object({
    destination: textField('направление', 120),
    purpose: z.string().max(2000, 'Цель: не более 2000 символов'),
    start_date: dateField,
    end_date: dateField,
    planned_amount: moneyField(true),
    user_id: selectField('сотрудник'),
    budget_id: selectField('бюджет'),
  })
  .refine((v) => !v.start_date || !v.end_date || v.end_date >= v.start_date, {
    path: ['end_date'],
    message: 'Дата окончания не может быть раньше даты начала',
  })

export type TripFormValues = z.infer<typeof tripFormSchema>
