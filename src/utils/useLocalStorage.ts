import { useState, useEffect, useRef } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  // Skip the first render so we don't overwrite localStorage with initialValue
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or private mode — fail silently
    }
  }, [key, value])

  return [value, setValue] as const
}
