'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export const FAVORITES_KEY = 'radyo_favorites'

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      setIds(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
    } catch {
      setIds([])
    }
  }, [])

  const persist = useCallback((next: string[]) => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    setIds(next)
  }, [])

  const toggle = useCallback(
    (id: string) => {
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
      persist(next)
    },
    [ids, persist],
  )

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids])

  const set = useMemo(
    () => ({
      ids,
      toggle,
      isFavorite,
    }),
    [ids, toggle, isFavorite],
  )

  return set
}
