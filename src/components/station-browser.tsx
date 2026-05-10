'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Station } from '@prisma/client'
import { toast } from 'sonner'
import { StationCard } from '@/components/station-card'
import { useFavorites } from '@/hooks/use-favorites'
import { usePlayerStore } from '@/stores/player-store'

type CatFilter = string | 'All' | 'Favorites'

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(typeof data === 'object' && data && 'error' in data && data.error ? String(data.error) : res.statusText)
  }
  return data as T
}

export function StationBrowser() {
  const [stations, setStations] = useState<Station[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [filter, setFilter] = useState<CatFilter>('All')
  const [loading, setLoading] = useState(true)
  const { ids: favoriteIds, toggle, isFavorite } = useFavorites()
  const setStation = usePlayerStore((s) => s.setStation)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [stRes, catRes] = await Promise.all([
        fetch('/api/stations'),
        fetch('/api/categories'),
      ])
      const [st, cats] = await Promise.all([
        parseJson<Station[]>(stRes),
        parseJson<string[]>(catRes),
      ])
      setStations(st)
      setCategories(cats)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load stations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visibleStations = useMemo(() => {
    if (filter === 'All') return stations
    if (filter === 'Favorites') return stations.filter((s) => favoriteIds.includes(s.id))
    return stations.filter((s) => s.category === filter)
  }, [stations, filter, favoriteIds])

  useEffect(() => {
    const cur = usePlayerStore.getState().currentStation
    if (cur && visibleStations.some((s) => s.id === cur.id)) {
      usePlayerStore.setState({ currentCategoryStations: visibleStations })
    }
  }, [visibleStations])

  const hideCategory = filter !== 'All' && filter !== 'Favorites'

  const patchLocal = useCallback((id: string, patch: Partial<Station>) => {
    setStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }, [])

  const removeLocal = useCallback((id: string) => {
    setStations((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleRename = async (id: string, name: string) => {
    const prev = stations
    patchLocal(id, { name })
    try {
      const res = await fetch(`/api/stations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      await parseJson<Station>(res)
    } catch (e) {
      setStations(prev)
      toast.error(e instanceof Error ? e.message : 'Rename failed')
      throw e
    }
  }

  const handleCategory = async (id: string, category: string | null) => {
    const prev = stations
    patchLocal(id, { category })
    try {
      const res = await fetch(`/api/stations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      await parseJson<Station>(res)
      const catRes = await fetch('/api/categories')
      setCategories(await parseJson<string[]>(catRes))
    } catch (e) {
      setStations(prev)
      toast.error(e instanceof Error ? e.message : 'Update failed')
      throw e
    }
  }

  const handleDelete = async (id: string) => {
    const prev = stations
    removeLocal(id)
    try {
      const res = await fetch(`/api/stations/${id}`, { method: 'DELETE' })
      await parseJson(res)
    } catch (e) {
      setStations(prev)
      toast.error(e instanceof Error ? e.message : 'Delete failed')
      throw e
    }
  }

  const play = (st: Station) => {
    setStation(st, visibleStations)
  }

  return (
    <div className="pb-24">
      <header className="mb-6 border-b border-neutral-800 pb-4">
        <h1 className="font-mono text-2xl tracking-tight text-[#e8ff00]">Radyo</h1>
        <p className="mt-1 font-sans text-sm text-neutral-400">Stream Turkish radio by category.</p>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['All', 'All' as CatFilter],
            ['Favorites', 'Favorites' as CatFilter],
            ...categories.map((c): [string, CatFilter] => [c, c]),
          ] as [string, CatFilter][]
        ).map(([label, value]) => {
          const active = filter === value
          return (
            <button
              key={label}
              type="button"
              onClick={() => setFilter(value)}
              className={
                active
                  ? 'rounded-full border border-[#e8ff00] bg-[#e8ff00] px-3 py-1 font-mono text-xs text-[#0a0a0a]'
                  : 'rounded-full border border-neutral-700 px-3 py-1 font-mono text-xs text-[#e8ff00] hover:border-[#e8ff00]'
              }
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="font-mono text-sm text-neutral-500">Loading…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleStations.map((st) => (
            <StationCard
              key={st.id}
              station={st}
              categories={categories}
              hideCategoryLabel={!!hideCategory}
              isFavorite={isFavorite(st.id)}
              onToggleFavorite={() => toggle(st.id)}
              onPlay={() => play(st)}
              onRename={(name) => handleRename(st.id, name)}
              onChangeCategory={(cat) => handleCategory(st.id, cat)}
              onSoftDelete={() => handleDelete(st.id)}
            />
          ))}
        </div>
      )}

      {!loading && visibleStations.length === 0 ? (
        <p className="font-mono text-sm text-neutral-500">No stations in this view.</p>
      ) : null}
    </div>
  )
}
