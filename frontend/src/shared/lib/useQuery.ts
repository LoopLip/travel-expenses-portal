import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, subscribeToChanges } from '../api'

export interface QueryState<T> {
  data: T | undefined
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Загрузка данных с состояниями «загрузка / ошибка / данные».
 * После любой мутации демо-данных запрос повторяется автоматически («актуальное отображение»).
 */
export function useQuery<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown> = []): QueryState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [manual, setManual] = useState(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  useEffect(() => subscribeToChanges(() => setTick((t) => t + 1)), [])

  useEffect(() => {
    let cancelled = false
    fetcherRef
      .current()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError(null)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, manual, ...deps])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setManual((m) => m + 1)
  }, [])

  return { data, loading, error, reload }
}
