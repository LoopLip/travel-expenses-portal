import type { ReactNode } from 'react'
import { Controller } from 'react-hook-form'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { TextField } from '@mui/material'
import type { TextFieldProps } from '@mui/material'

type Props<T extends FieldValues> = Omit<TextFieldProps, 'name' | 'defaultValue' | 'error' | 'helperText'> & {
  control: Control<T>
  name: FieldPath<T>
  label: string
  children?: ReactNode
  hint?: string
}

/** Поле формы (react-hook-form + MUI): ошибка валидации показывается под полем на русском. */
export default function FormField<T extends FieldValues>({ control, name, label, children, hint, type, ...rest }: Props<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...rest}
          {...field}
          value={field.value ?? ''}
          label={label}
          type={type}
          fullWidth
          error={Boolean(fieldState.error)}
          helperText={fieldState.error?.message ?? hint}
          id={name}
          slotProps={{ ...rest.slotProps, inputLabel: type === 'date' ? { shrink: true } : undefined }}
        >
          {children}
        </TextField>
      )}
    />
  )
}
