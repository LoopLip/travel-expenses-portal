import { useEffect, useState } from 'react'

/** Значение с задержкой: поиск уходит на сервер, когда пользователь перестал печатать, а не на каждую букву. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
