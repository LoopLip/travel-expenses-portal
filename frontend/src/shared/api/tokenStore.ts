/**
 * Access-токен хранится только в памяти страницы (не в localStorage/sessionStorage): так его не прочитает
 * чужой скрипт, внедрённый через XSS из хранилища. После перезагрузки токен получают заново по refresh-cookie.
 */
let accessToken: string | null = null

export const tokenStore = {
  get: (): string | null => accessToken,
  set: (token: string): void => {
    accessToken = token
  },
  clear: (): void => {
    accessToken = null
  },
}
