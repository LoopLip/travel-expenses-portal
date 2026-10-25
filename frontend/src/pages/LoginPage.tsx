import { LoginForm } from '@/features/auth-login'
import { AuthLayout } from '@/shared/ui'

export default function LoginPage() {
  return (
    <AuthLayout title="Вход" subtitle="Войдите, чтобы работать с командировками и расходами">
      <LoginForm />
    </AuthLayout>
  )
}
