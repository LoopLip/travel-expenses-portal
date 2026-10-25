import { RegisterForm } from '@/features/auth-register'
import { AuthLayout } from '@/shared/ui'

export default function RegisterPage() {
  return (
    <AuthLayout title="Регистрация" subtitle="Создайте учётную запись сотрудника">
      <RegisterForm />
    </AuthLayout>
  )
}
