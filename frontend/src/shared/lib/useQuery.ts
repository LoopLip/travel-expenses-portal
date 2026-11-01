import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, errorMessage, isAbortError, subscribeToChanges } from '../api'

export interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  /** HTTP-статус ошибки (если это ошибка API): позволяет отличить 403 и 404 от обычного сбоя. */
  errorStatus: number | null
  reload: () => void
}

/**
 * Загрузка данных с состояниями «загрузка / ошибка / данные».
 * - fetcher получает AbortSignal: при смене параметров (deps) или уходе со страницы прежний запрос отменяется,
 *   поэтому устаревший ответ не перезапишет новый;
 * - после любой успешной мутации (шина notifyDataChanged) запрос повторяется автоматически, прежние данные
 *   остаются на экране до прихода новых (без мигания скелетона).
 */
export function useQuery<T>(fetcher: (signal: AbortSignal) => Promise<T>, deps: ReadonlyArray<unknown> = []): QueryState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const [manual, setManual] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => subscribeToChanges(() => setTick((t) => t + 1)), [])

  useEffect(() => {
    const controller = new AbortController()
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setData(result)
        setError(null)
        setErrorStatus(null)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted || isAbortError(e)) return
        setError(errorMessage(e))
        setErrorStatus(e instanceof ApiError ? e.status : null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, manual, ...deps])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setManual((m) => m + 1)
  }, [])

  return { data, loading, error, errorStatus, reload }
}
