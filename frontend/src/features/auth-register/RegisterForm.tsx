import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, Button, Collapse, Link, Stack, Typography } from '@mui/material'
import { registerSchema, useSession } from '@/entities/session'
import type { RegisterValues } from '@/entities/session'
import { errorMessage } from '@/shared/api'
import { FormField } from '@/shared/ui'

/** Форма регистрации. Роль выбрать нельзя: новый пользователь всегда сотрудник. После успеха выполняется вход. */
export default function RegisterForm() {
  const { register } = useSession()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: { full_name: '', email: '', department: '', password: '', confirm: '' },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await register({ full_name: values.full_name, email: values.email, password: values.password, department: values.department })
      navigate('/', { replace: true })
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label="Форма регистрации">
      <Stack spacing={2}>
        <FormField control={control} name="full_name" label="Имя и фамилия" autoComplete="name" />
        <FormField control={control} name="email" label="Email" type="email" autoComplete="username" />
        <FormField control={control} name="department" label="Отдел (необязательно)" />
        <FormField control={control} name="password" label="Пароль" type="password" autoComplete="new-password" hint="Не короче 8 символов" />
        <FormField control={control} name="confirm" label="Повторите пароль" type="password" autoComplete="new-password" />
        <Collapse in={Boolean(serverError)}>
          <Alert severity="error" data-testid="form-server-error">{serverError}</Alert>
        </Collapse>
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Регистрируем…' : 'Зарегистрироваться'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          Уже есть аккаунт? <Link component={RouterLink} to="/login">Войти</Link>
        </Typography>
      </Stack>
    </form>
  )
}
