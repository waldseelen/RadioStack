'use client'

import { StationCard } from '@/components/station-card'
import { useFavorites } from '@/hooks/use-favorites'
import { usePlayerStore } from '@/stores/player-store'
import type { Station } from '@prisma/client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Search, ListFilter, Activity, Settings, CheckSquare, Trash2, FolderEdit, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type CatFilter = string | 'All' | 'Favorites'

interface StationBrowserProps {
    onOpenSettings?: () => void
}

async function parseJson<T>(res: Response): Promise<T> {
    const text = await res.text()
    if (!text) {
        if (!res.ok) throw new Error(res.statusText || 'Request failed')
        throw new Error('Empty response from server')
    }

    let data: T & { error?: string }
    try {
        data = JSON.parse(text) as T & { error?: string }
    } catch {
        throw new Error('Invalid JSON response')
    }

    if (!res.ok) {
        throw new Error(
            typeof data === 'object' && data && 'error' in data && data.error
                ? String(data.error)
                : res.statusText || 'Request failed',
        )
    }
    return data as T
}

export function StationBrowser({ onOpenSettings }: StationBrowserProps) {
    const [stations, setStations] = useState<Station[]>([])
    const [categories, setCategories] = useState<string[]>([])
    const [filter, setFilter] = useState<CatFilter>('All')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    
    const { ids: favoriteIds, toggle, isFavorite } = useFavorites()
    const { setStation, togglePlay, currentStation } = usePlayerStore()

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

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

            if (e.code === 'Space') {
                e.preventDefault()
                togglePlay()
            }
            if (e.code === 'KeyL' && currentStation) {
                e.preventDefault()
                toggle(currentStation.id)
                toast.success(isFavorite(currentStation.id) ? 'Removed' : 'Added')
            }
        }
        window.addEventListener('keydown', handleKeys)
        return () => window.removeEventListener('keydown', handleKeys)
    }, [togglePlay, toggle, currentStation, isFavorite])

    const counts = useMemo(() => {
        const m = new Map<string, number>()
        m.set('All', stations.length)
        m.set('Favorites', favoriteIds.length)
        for (const s of stations) {
            if (s.category) {
                m.set(s.category, (m.get(s.category) || 0) + 1)
            }
        }
        return m
    }, [stations, favoriteIds])

    const filteredStations = useMemo(() => {
        let list = stations
        if (filter === 'Favorites') {
            list = stations.filter((s) => favoriteIds.includes(s.id))
        } else if (filter !== 'All') {
            list = stations.filter((s) => s.category === filter)
        }

        if (search.trim()) {
            const q = search.toLowerCase().trim()
            list = list.filter((s) => 
                s.name.toLowerCase().includes(q) || 
                s.category?.toLowerCase().includes(q)
            )
        }
        return list
    }, [stations, filter, favoriteIds, search])

    useEffect(() => {
        const cur = usePlayerStore.getState().currentStation
        if (cur && filteredStations.some((s) => s.id === cur.id)) {
            usePlayerStore.setState({ currentCategoryStations: filteredStations })
        }
    }, [filteredStations])

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

    const handleMarkOffline = async (id: string) => {
        const prev = stations
        removeLocal(id)
        try {
            const res = await fetch(`/api/stations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isLive: false }),
            })
            await parseJson(res)
            toast.success('Station marked as offline')
        } catch (e) {
            setStations(prev)
            toast.error(e instanceof Error ? e.message : 'Mark offline failed')
            throw e
        }
    }

    // Bulk Actions
    const handleBulkDelete = async () => {
        const ids = Array.from(selectedIds)
        if (!confirm(`Delete ${ids.length} stations?`)) return
        
        const prev = stations
        setStations(prev => prev.filter(s => !selectedIds.has(s.id)))
        setSelectedIds(new Set())
        
        try {
            await Promise.all(ids.map(id => fetch(`/api/stations/${id}`, { method: 'DELETE' })))
            toast.success(`${ids.length} stations deleted`)
        } catch {
            setStations(prev)
            toast.error('Bulk delete partially failed')
        }
    }

    const handleBulkCategory = async () => {
        const cat = prompt('Enter new category name:')
        if (!cat) return
        
        const ids = Array.from(selectedIds)
        const prev = stations
        
        setStations(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, category: cat } : s))
        setSelectedIds(new Set())
        
        try {
            await Promise.all(ids.map(id => fetch(`/api/stations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category: cat }),
            })))
            const catRes = await fetch('/api/categories')
            setCategories(await parseJson<string[]>(catRes))
            toast.success(`Category updated for ${ids.length} stations`)
        } catch {
            setStations(prev)
            toast.error('Bulk update partially failed')
        }
    }

    const play = (st: Station) => {
        setStation(st, filteredStations)
    }

    // Split categories into two rows
    const catOptions = useMemo(() => {
        const options: [string, CatFilter][] = [
            ['Favorites', 'Favorites'],
            ...categories.map((c): [string, CatFilter] => [c, c]),
        ]
        const mid = Math.ceil(options.length / 2)
        return {
            row1: options.slice(0, mid),
            row2: options.slice(mid)
        }
    }, [categories])

    const renderCatButton = ([label, value]: [string, CatFilter]) => {
        const active = filter === value
        const count = counts.get(value) || 0
        return (
            <button
                key={label}
                type="button"
                onClick={() => setFilter(active ? 'All' : value)}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1 font-sans text-[11px] font-medium transition-colors border shrink-0",
                    active
                        ? "bg-accent text-black border-accent"
                        : "text-neutral-500 border-neutral-800 hover:border-accent hover:text-accent"
                )}
            >
                {label}
                <span className={cn(
                    "font-mono text-[9px]",
                    active ? "text-black/60" : "text-neutral-700"
                )}>
                    {count}
                </span>
            </button>
        )
    }

    const toggleSelect = (id: string, selected: boolean) => {
        const next = new Set(selectedIds)
        if (selected) next.add(id)
        else next.delete(id)
        setSelectedIds(next)
    }

    return (
        <div className="pb-32 font-sans">
            {/* Header / Command Bar - Sticky */}
            <header className="sticky top-0 z-40 bg-black border-b border-neutral-800 pb-2 mb-6 pt-6 px-4 -mx-4 shadow-xl">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-neutral-900 border border-neutral-800 p-1.5">
                            <Activity className="h-4 w-4 text-accent" />
                        </div>
                        <h1 className="text-sm font-semibold tracking-tight text-neutral-200">RadioStack</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="relative group w-48 md:w-64">
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                                <Search className="h-3.5 w-3.5" />
                            </div>
                            <input 
                                type="text"
                                placeholder="Search stations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-8 bg-black border border-neutral-800 px-8 font-sans text-xs text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-accent transition-colors"
                            />
                        </div>

                        {/* Settings Button */}
                        <button
                            onClick={onOpenSettings}
                            className="flex items-center gap-2 h-8 px-3 bg-neutral-900 border border-neutral-800 font-mono text-[10px] uppercase font-bold text-accent hover:text-white hover:border-neutral-600 transition-all group"
                        >
                            <Settings className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-500" />
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                    </div>
                </div>

                {/* Categories - Two Rows & Responsive */}
                <div className="mt-4 border-t border-neutral-800 pt-4 space-y-2">
                    <div className="flex items-center justify-center gap-2 mb-2 text-neutral-700">
                        <ListFilter className="h-3 w-3" />
                        <span className="font-mono text-[9px] uppercase tracking-[0.2em]">Categories</span>
                    </div>
                    
                    <div className="flex flex-col gap-1.5 max-w-full overflow-x-auto pb-2 scrollbar-hide">
                        <div className="flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-1.5 px-4 min-w-max md:min-w-0">
                            {catOptions.row1.map(renderCatButton)}
                        </div>
                        <div className="flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-1.5 px-4 min-w-max md:min-w-0">
                            {catOptions.row2.map(renderCatButton)}
                        </div>
                    </div>
                </div>
            </header>

            {/* Bulk Action Bar */}
            {selectedIds.size > 0 && (
                <div className="sticky top-44 md:top-40 z-30 flex items-center justify-center animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-accent text-black px-6 py-2 border border-black shadow-2xl flex items-center gap-6">
                        <div className="flex items-center gap-2 border-r border-black/20 pr-4">
                            <CheckSquare className="h-4 w-4" />
                            <span className="font-mono text-xs font-bold uppercase">{selectedIds.size} Selected</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleBulkCategory}
                                className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold hover:underline"
                            >
                                <FolderEdit className="h-3.5 w-3.5" />
                                Move to Category
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold hover:underline"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete All
                            </button>
                            <button 
                                onClick={() => setSelectedIds(new Set())}
                                className="ml-2 p-1 hover:bg-black/10 rounded"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col py-20 items-center">
                    <p className="font-mono text-[10px] text-neutral-600 uppercase tracking-widest animate-pulse">Syncing directory...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-neutral-800 border border-neutral-800">
                    {filteredStations.map((st) => (
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
                            onMarkOffline={() => handleMarkOffline(st.id)}
                            searchQuery={search}
                            isSelected={selectedIds.has(st.id)}
                            onSelect={(sel) => toggleSelect(st.id, sel)}
                        />
                    ))}
                </div>
            )}

            {/* Empty States */}
            {!loading && filteredStations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 border border-dashed border-neutral-800 mt-4 bg-neutral-900/10">
                    <div className="bg-neutral-900 p-4 rounded-full mb-6">
                        <Info className="h-8 w-8 text-neutral-700" />
                    </div>
                    <h3 className="font-sans text-lg font-medium text-neutral-400 mb-2">No matching stations</h3>
                    <p className="font-sans text-sm text-neutral-600 mb-8 max-w-xs text-center">
                        {filter === 'Favorites' 
                            ? "You haven't added any stations to your favorites yet." 
                            : "Try adjusting your search or category filters to find what you're looking for."}
                    </p>
                    <button 
                        onClick={() => { setSearch(''); setFilter('All'); load(); }}
                        className="px-6 py-2 bg-neutral-800 text-neutral-300 font-mono text-[10px] uppercase font-bold tracking-widest hover:bg-accent hover:text-black transition-all"
                    >
                        Reset All Filters
                    </button>
                </div>
            ) : null}
        </div>
    )
}
