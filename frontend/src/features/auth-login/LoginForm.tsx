import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Alert, Button, Collapse, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { loginSchema, useSession } from '@/entities/session'
import type { LoginValues } from '@/entities/session'
import { errorMessage } from '@/shared/api'
import { FormField } from '@/shared/ui'

/** Форма входа: проверка полей на клиенте, ошибка сервера («Неверный email или пароль») под формой. */
export default function LoginForm() {
  const { login } = useSession()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const { control, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit(async (values) => {
    setServerError(null)
    try {
      await login(values.email, values.password)
      navigate('/', { replace: true }) // GuestRoute перенаправит на запрошенную страницу, если она была
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  return (
    <form onSubmit={submit} noValidate aria-label="Форма входа">
      <Stack spacing={2}>
        <FormField control={control} name="email" label="Email" type="email" autoComplete="username" />
        <FormField control={control} name="password" label="Пароль" type="password" autoComplete="current-password" />
        <Collapse in={Boolean(serverError)}>
          <Alert severity="error" data-testid="form-server-error">{serverError}</Alert>
        </Collapse>
        <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? 'Входим…' : 'Войти'}
        </Button>
        <Typography variant="body2" color="text.secondary">
          Нет аккаунта? <Link component={RouterLink} to="/register">Зарегистрироваться</Link>
        </Typography>
      </Stack>
    </form>
  )
}
