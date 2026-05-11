'use client'

import type { Station } from '@prisma/client'
import { Trash2, Undo2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type Tab = 'stations' | 'import' | 'trash'

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

export function AdminPanel() {
    const [tab, setTab] = useState<Tab>('stations')
    const [stations, setStations] = useState<Station[]>([])
    const [trash, setTrash] = useState<Station[]>([])
    const [m3uText, setM3uText] = useState('')
    const [loading, setLoading] = useState(true)

    const loadActive = useCallback(async () => {
        const res = await fetch('/api/stations')
        const data = await parseJson<Station[]>(res)
        setStations(data)
    }, [])

    const loadTrash = useCallback(async () => {
        const res = await fetch('/api/stations/trash')
        const data = await parseJson<Station[]>(res)
        setTrash(data)
    }, [])

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            await Promise.all([loadActive(), loadTrash()])
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Load failed')
        } finally {
            setLoading(false)
        }
    }, [loadActive, loadTrash])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const byCategory = useMemo(() => {
        const m = new Map<string, Station[]>()
        for (const s of stations) {
            const c = s.category ?? 'Uncategorized'
            if (!m.has(c)) m.set(c, [])
            m.get(c)!.push(s)
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [stations])

    const trashByCategory = useMemo(() => {
        const m = new Map<string, Station[]>()
        for (const s of trash) {
            const c = s.category ?? 'Uncategorized'
            if (!m.has(c)) m.set(c, [])
            m.get(c)!.push(s)
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [trash])

    const softDeleteCategory = async (name: string) => {
        const prev = stations
        setStations((cur) => cur.filter((s) => (s.category ?? 'Uncategorized') !== name))
        try {
            const res = await fetch(`/api/categories/${encodeURIComponent(name)}`, {
                method: 'DELETE',
            })
            await parseJson(res)
            await loadTrash()
        } catch (e) {
            setStations(prev)
            toast.error(e instanceof Error ? e.message : 'Category delete failed')
        }
    }

    const restoreStation = async (id: string) => {
        const snapT = trash
        const snapA = stations
        const st = trash.find((x) => x.id === id)
        if (!st) return
        setTrash((t) => t.filter((x) => x.id !== id))
        setStations((a) => [...a, { ...st, deletedAt: null }])
        try {
            const res = await fetch(`/api/stations/${id}/restore`, { method: 'POST' })
            await parseJson(res)
            await Promise.all([loadActive(), loadTrash()])
        } catch (e) {
            setTrash(snapT)
            setStations(snapA)
            toast.error(e instanceof Error ? e.message : 'Restore failed')
        }
    }

    const restoreCategory = async (name: string) => {
        const snapT = trash
        const snapA = stations
        const affected = trash.filter((s) => (s.category ?? 'Uncategorized') === name)
        setTrash((t) => t.filter((s) => (s.category ?? 'Uncategorized') !== name))
        setStations((a) => [...a, ...affected.map((s) => ({ ...s, deletedAt: null }))])
        try {
            const res = await fetch(`/api/categories/${encodeURIComponent(name)}/restore`, {
                method: 'POST',
            })
            await parseJson(res)
            await Promise.all([loadActive(), loadTrash()])
        } catch (e) {
            setTrash(snapT)
            setStations(snapA)
            toast.error(e instanceof Error ? e.message : 'Restore failed')
        }
    }

    const emptyTrash = async () => {
        const snap = trash
        setTrash([])
        try {
            const res = await fetch('/api/stations/trash', { method: 'DELETE' })
            await parseJson(res)
            await loadActive()
        } catch (e) {
            setTrash(snap)
            toast.error(e instanceof Error ? e.message : 'Empty trash failed')
        }
    }

    const submitImport = async () => {
        try {
            const res = await fetch('/api/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: m3uText }),
            })
            const data = await parseJson<{ created: number; updated: number; total: number }>(res)
            toast.success(`Import OK: ${data.created} new, ${data.updated} updated`)
            setM3uText('')
            await refresh()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Import failed')
        }
    }

    const trashCount = trash.length

    return (
        <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-mono text-2xl text-[#e8ff00]">Admin</h1>
                    <Link href="/" className="mt-1 inline-block font-mono text-sm text-neutral-400 hover:text-[#e8ff00]">
                        ← Back to player
                    </Link>
                </div>
                <nav className="flex flex-wrap gap-2 font-mono text-sm">
                    {(
                        [
                            ['stations', 'Stations'],
                            ['import', 'Import'],
                            ['trash', `Trash (${trashCount})`],
                        ] as const
                    ).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setTab(id)}
                            className={
                                tab === id
                                    ? 'rounded border border-[#e8ff00] bg-[#e8ff00] px-3 py-1 text-[#0a0a0a]'
                                    : 'rounded border border-neutral-700 px-3 py-1 text-[#e8ff00] hover:border-[#e8ff00]'
                            }
                        >
                            {label}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? (
                <p className="font-mono text-sm text-neutral-500">Loading…</p>
            ) : tab === 'stations' ? (
                <div className="space-y-8">
                    {byCategory.length === 0 ? (
                        <p className="font-mono text-sm text-neutral-500">No active stations.</p>
                    ) : null}
                    {byCategory.map(([cat, list]) => (
                        <section key={cat} className="rounded-lg border border-neutral-800 bg-[#141414] p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="font-mono text-lg text-[#e8ff00]">
                                    {cat}{' '}
                                    <span className="text-xs text-neutral-500">({list.length})</span>
                                </h2>
                                <button
                                    type="button"
                                    className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 text-[#e8ff00] hover:border-[#e8ff00]"
                                    title="Soft delete all stations in this category"
                                    onClick={() => softDeleteCategory(cat)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <ul className="divide-y divide-neutral-800">
                                {list.map((s) => (
                                    <li key={s.id} className="py-2 font-sans text-sm text-neutral-200">
                                        {s.name}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            ) : tab === 'import' ? (
                <div className="rounded-lg border border-neutral-800 bg-[#141414] p-4">
                    <p className="mb-2 font-mono text-sm text-[#e8ff00]">M3U import</p>
                    <p className="mb-3 font-sans text-xs text-neutral-500">
                        Rate limit: 3 requests per 60 seconds per IP.
                    </p>
                    <textarea
                        className="min-h-[200px] w-full rounded border border-neutral-700 bg-[#0a0a0a] p-3 font-mono text-xs text-[#e8ff00] outline-none focus:border-[#e8ff00]"
                        placeholder="#EXTM3U..."
                        value={m3uText}
                        onChange={(e) => setM3uText(e.target.value)}
                    />
                    <button
                        type="button"
                        className="mt-3 rounded border border-[#e8ff00] bg-[#e8ff00] px-4 py-2 font-mono text-sm text-[#0a0a0a] hover:opacity-90"
                        onClick={() => void submitImport()}
                    >
                        Import
                    </button>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-end">
                        <button
                            type="button"
                            disabled={trash.length === 0}
                            className="rounded border border-red-700 px-3 py-2 font-mono text-sm text-red-300 hover:bg-red-950 disabled:opacity-40"
                            onClick={() => void emptyTrash()}
                        >
                            Empty Trash
                        </button>
                    </div>
                    {trash.length === 0 ? (
                        <p className="font-mono text-sm text-neutral-500">Trash is empty</p>
                    ) : (
                        trashByCategory.map(([cat, list]) => (
                            <section key={cat} className="rounded-lg border border-neutral-800 bg-[#141414] p-4">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="font-mono text-lg text-[#e8ff00]">{cat}</h2>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1 rounded border border-neutral-700 px-2 py-1 font-mono text-xs text-[#e8ff00] hover:border-[#e8ff00]"
                                        onClick={() => void restoreCategory(cat)}
                                    >
                                        <Undo2 className="h-3 w-3" />
                                        Restore Category
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="font-mono text-xs text-neutral-500">
                                                <th className="pb-2 pr-4">Name</th>
                                                <th className="pb-2 pr-4">Category</th>
                                                <th className="pb-2 pr-4">Deleted</th>
                                                <th className="pb-2" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {list.map((s) => (
                                                <tr key={s.id} className="border-t border-neutral-800">
                                                    <td className="py-2 pr-4 font-sans text-neutral-200">{s.name}</td>
                                                    <td className="py-2 pr-4 font-sans text-neutral-400">
                                                        {s.category ?? '—'}
                                                    </td>
                                                    <td className="py-2 pr-4 font-mono text-xs text-neutral-500">
                                                        {s.deletedAt ? new Date(s.deletedAt).toLocaleString() : '—'}
                                                    </td>
                                                    <td className="py-2 text-right">
                                                        <button
                                                            type="button"
                                                            className="rounded border border-neutral-700 px-2 py-1 font-mono text-xs text-[#e8ff00] hover:border-[#e8ff00]"
                                                            onClick={() => void restoreStation(s.id)}
                                                        >
                                                            Restore
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
