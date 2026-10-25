import { emailField, textField, z } from '@/shared/lib'

/** Правила повторяют backend: пароль 8–128 символов, имя до 120, email нормализуется в нижний регистр. */
const passwordField = z
  .string()
  .min(8, 'Пароль: не короче 8 символов')
  .max(128, 'Пароль: не длиннее 128 символов')

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Введите пароль'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    full_name: textField('имя и фамилия', 120),
    email: emailField,
    department: z.string().trim().max(120, 'Отдел: не более 120 символов'),
    password: passwordField,
    confirm: z.string().min(1, 'Повторите пароль'),
  })
  .refine((v) => !v.password || !v.confirm || v.password === v.confirm, {
    path: ['confirm'],
    message: 'Пароли не совпадают',
  })
export type RegisterValues = z.infer<typeof registerSchema>
