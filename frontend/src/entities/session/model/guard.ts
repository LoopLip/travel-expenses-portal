export type GuardState = 'loading' | 'authenticated' | 'anonymous'

export type GuardDecision =
  | { type: 'wait' }
  | { type: 'allow' }
  | { type: 'redirect'; to: string; from?: string }

/** Охрана закрытых страниц: ждём восстановления сессии, гостя отправляем на вход и запоминаем, куда он шёл. */
export function resolveProtected(
  status: GuardState,
  location: { pathname: string; search?: string },
  rememberFrom = true,
): GuardDecision {
  if (status === 'loading') return { type: 'wait' }
  if (status === 'authenticated') return { type: 'allow' }
  // После явного выхода страницу не запоминаем: следующий вошедший не должен попасть на чужой «последний экран».
  return { type: 'redirect', to: '/login', from: rememberFrom ? `${location.pathname}${location.search ?? ''}` : undefined }
}

/** Страницы входа и регистрации нужны только гостям: вошедшего возвращаем туда, откуда его перенаправили (или на главную). */
export function resolveGuest(status: GuardState, from?: string): GuardDecision {
  if (status === 'loading') return { type: 'wait' }
  if (status === 'authenticated') return { type: 'redirect', to: safeReturnPath(from) }
  return { type: 'allow' }
}

/** Возвращаем только внутренние пути (защита от перенаправления на чужой сайт и на страницы входа). */
export function safeReturnPath(from?: string): string {
  if (!from || !from.startsWith('/') || from.startsWith('//')) return '/'
  if (from.startsWith('/login') || from.startsWith('/register')) return '/'
  return from
}
