import type { ReactNode } from 'react'
import { Fade } from '@mui/material'
import type { QueryState } from '../lib/useQuery'
import { useMotionTimeout } from '../lib/useMotion'
import { EmptyState, ErrorState, LoadingState } from './StateViews'

interface Props<T> {
  query: QueryState<T>
  /** Когда данные считаются пустыми. По умолчанию: пустой массив. */
  isEmpty?: (data: T) => boolean
  empty: { title: string; description?: string; action?: ReactNode }
  skeletonRows?: number
  children: (data: T) => ReactNode
}

/** Единая обработка состояний загрузки, ошибки и отсутствия данных для любого запроса. */
export default function QueryBoundary<T>({ query, isEmpty, empty, skeletonRows, children }: Props<T>) {
  const timeout = useMotionTimeout()
  const { data, loading, error, reload } = query

  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading || data === undefined) return <LoadingState rows={skeletonRows} />

  const emptyCheck = isEmpty ?? ((d: T) => Array.isArray(d) && d.length === 0)
  if (emptyCheck(data)) return <EmptyState {...empty} />

  return (
    <Fade in appear timeout={timeout}>
      <div>{children(data)}</div>
    </Fade>
  )
}
