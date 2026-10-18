import { createContext, useContext } from 'react'

export type Severity = 'success' | 'error' | 'info'

export interface Notifier {
  notify: (text: string, severity?: Severity) => void
}

export const NotifyContext = createContext<Notifier>({ notify: () => undefined })

export const useNotify = () => useContext(NotifyContext).notify
