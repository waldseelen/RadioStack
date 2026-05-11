'use client'

import type { Station } from '@prisma/client'
import { Trash2, Upload, Trash, Info, Settings, RefreshCcw, Download, X, FileText, Code, FileJson } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Tab = 'import' | 'trash' | 'export'
type ExportFormat = 'm3u' | 'm3u8' | 'csv' | 'txt' | 'xspf'

interface AdminPanelProps {
    onClose: () => void
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

export function AdminPanel({ onClose }: AdminPanelProps) {
    const [tab, setTab] = useState<Tab>('import')
    const [stations, setStations] = useState<Station[]>([])
    const [trash, setTrash] = useState<Station[]>([])
    const [m3uText, setM3uText] = useState('')
    const [loading, setLoading] = useState(true)
    const [exportFormat, setExportFormat] = useState<ExportFormat>('m3u')
    
    const modalRef = useRef<HTMLDivElement>(null)

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

    const trashByCategory = useMemo(() => {
        const m = new Map<string, Station[]>()
        for (const s of trash) {
            const c = s.category ?? 'Uncategorized'
            if (!m.has(c)) m.set(c, [])
            m.get(c)!.push(s)
        }
        return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    }, [trash])

    const m3uStats = useMemo(() => {
        if (!m3uText.trim()) return { items: 0 }
        const lines = m3uText.split('\n')
        const items = lines.filter(l => l.startsWith('#EXTINF')).length
        return { items }
    }, [m3uText])

    const handleExport = () => {
        let content = ''
        let type = 'text/plain'
        const filename = `radiostack_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`

        switch (exportFormat) {
            case 'm3u':
            case 'm3u8':
                content = '#EXTM3U\n'
                for (const s of stations) {
                    content += `#EXTINF:-1 tvg-logo="${s.logo || ''}" group-title="${s.category || 'Uncategorized'}",${s.name}\n`
                    content += `${s.streamUrl}\n`
                }
                break
            case 'csv':
                type = 'text/csv'
                content = 'Name,URL,Category,Logo\n'
                for (const s of stations) {
                    content += `"${s.name}","${s.streamUrl}","${s.category || ''}","${s.logo || ''}"\n`
                }
                break
            case 'txt':
                for (const s of stations) {
                    content += `${s.name}: ${s.streamUrl}\n`
                }
                break
            case 'xspf':
                type = 'application/xspf+xml'
                content = `<?xml version="1.0" encoding="UTF-8"?>\n<playlist version="1" xmlns="http://xspf.org/ns/0/">\n  <trackList>\n`
                for (const s of stations) {
                    content += `    <track>\n      <title>${s.name}</title>\n      <location>${s.streamUrl}</location>\n      <image>${s.logo || ''}</image>\n      <annotation>${s.category || ''}</annotation>\n    </track>\n`
                }
                content += `  </trackList>\n</playlist>`
                break
        }

        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported as ${exportFormat.toUpperCase()}`)
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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            setM3uText(ev.target?.result as string)
            toast.info('File loaded successfully')
        }
        reader.readAsText(file)
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
        <div 
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div 
                ref={modalRef}
                className="w-full max-w-5xl h-full max-h-[800px] bg-black border border-neutral-800 shadow-2xl flex overflow-hidden rounded-none"
            >
                {/* Compact Sidebar */}
                <aside className="w-16 md:w-56 border-r border-neutral-800 flex flex-col bg-black">
                    <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
                        <div className="bg-neutral-900 p-1 border border-neutral-700 shrink-0">
                           <Settings className="h-4 w-4 text-accent" />
                        </div>
                        <span className="hidden md:block text-[11px] font-bold uppercase tracking-widest text-accent">Settings</span>
                    </div>

                    <nav className="flex-1 p-2 flex flex-col gap-1 mt-4">
                        {(
                            [
                                ['import', 'Import', Upload],
                                ['export', 'Export', Download],
                                ['trash', `Trash (${trashCount})`, Trash],
                            ] as const
                        ).map(([id, label, Icon]) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-3 text-[11px] font-semibold uppercase tracking-wider transition-all",
                                    tab === id
                                        ? "bg-accent text-black font-bold"
                                        : "text-neutral-500 hover:text-accent hover:bg-neutral-900/50"
                                )}
                                title={label}
                            >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="hidden md:block truncate">{label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-neutral-800 hidden md:block">
                         <p className="text-[9px] font-mono text-neutral-700 uppercase tracking-widest">RadioStack v1.2</p>
                    </div>
                </aside>

                {/* Content Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#050505]">
                    <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-6 bg-black">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest">
                           <span className="text-neutral-600">Settings</span>
                           <span className="text-neutral-800">/</span>
                           <span className="text-accent uppercase">{tab}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => refresh()}
                                className="p-2 text-neutral-500 hover:text-accent transition-colors"
                                title="Refresh"
                            >
                                <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
                            </button>
                            <button 
                                onClick={onClose}
                                className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-600 transition-all"
                                title="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-auto p-6 md:p-10">
                        {loading && stations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="h-5 w-5 border-2 border-neutral-800 border-t-accent rounded-full animate-spin" />
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-600">Synchronizing Data</p>
                            </div>
                        ) : tab === 'import' ? (
                            <div className="max-w-2xl border border-neutral-800 bg-black/40 mx-auto animate-in fade-in duration-500">
                                <div className="p-4 border-b border-neutral-800 bg-neutral-900/20 flex items-center gap-2">
                                   <Upload className="h-4 w-4 text-accent" />
                                   <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">Data Import Engine</h2>
                                </div>
                                
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase text-neutral-600">Upload File</label>
                                            <input 
                                                type="file" 
                                                accept=".m3u,.m3u8,.txt"
                                                onChange={handleFileUpload}
                                                className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-[10px] file:font-bold file:uppercase file:bg-neutral-800 file:text-accent hover:file:bg-accent hover:file:text-black transition-all cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 bg-neutral-950 p-4 border border-neutral-900 text-[9px] text-neutral-600 leading-relaxed font-medium uppercase tracking-wider">
                                            <Info className="h-4 w-4 text-neutral-800 shrink-0" />
                                            <span>You can select a file or paste raw playlist data below.</span>
                                        </div>
                                    </div>

                                    <div className="relative border border-neutral-800 focus-within:border-accent transition-colors">
                                        <textarea
                                            className="min-h-[300px] w-full bg-black p-4 font-mono text-xs text-neutral-500 outline-none resize-none"
                                            placeholder="#EXTM3U..."
                                            value={m3uText}
                                            onChange={(e) => setM3uText(e.target.value)}
                                        />
                                        {m3uStats.items > 0 && (
                                           <div className="absolute bottom-4 right-4 bg-accent text-black px-2 py-1 font-mono text-[9px] font-bold">
                                              {m3uStats.items} RECORDS DETECTED
                                           </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            disabled={!m3uText.trim()}
                                            className="px-8 py-2.5 bg-accent text-black text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 disabled:opacity-30 transition-all shadow-[0_0_15px_rgba(232,255,0,0.2)]"
                                            onClick={() => void submitImport()}
                                        >
                                            Process and Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : tab === 'export' ? (
                            <div className="max-w-2xl border border-neutral-800 bg-black/40 mx-auto animate-in fade-in duration-500">
                                <div className="p-4 border-b border-neutral-800 bg-neutral-900/20 flex items-center gap-2">
                                   <Download className="h-4 w-4 text-accent" />
                                   <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">Data Export</h2>
                                </div>
                                
                                <div className="p-10 space-y-8">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                        {(['m3u', 'm3u8', 'csv', 'txt', 'xspf'] as ExportFormat[]).map((fmt) => (
                                            <button
                                                key={fmt}
                                                onClick={() => setExportFormat(fmt)}
                                                className={cn(
                                                    "flex flex-col items-center justify-center p-4 border transition-all gap-2",
                                                    exportFormat === fmt 
                                                        ? "border-accent bg-accent/5 text-accent shadow-[inset_0_0_10px_rgba(232,255,0,0.1)]" 
                                                        : "border-neutral-800 text-neutral-600 hover:border-neutral-600"
                                                )}
                                            >
                                                {fmt === 'csv' ? <FileText className="h-5 w-5" /> : fmt === 'xspf' ? <Code className="h-5 w-5" /> : <FileJson className="h-5 w-5" />}
                                                <span className="text-[10px] font-bold uppercase">{fmt}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className="bg-neutral-950 p-6 border border-neutral-900">
                                        <h3 className="text-[10px] font-bold uppercase text-neutral-500 mb-2">Format Summary</h3>
                                        <p className="text-[11px] text-neutral-600 leading-relaxed uppercase tracking-wider">
                                            {exportFormat === 'm3u' && 'Standard media playlist format.'}
                                            {exportFormat === 'm3u8' && 'Enhanced playlist with UTF-8 support.'}
                                            {exportFormat === 'csv' && 'Comma separated values for Excel and databases.'}
                                            {exportFormat === 'txt' && 'Plain text list containing names and URLs.'}
                                            {exportFormat === 'xspf' && 'XML based advanced media sharing format.'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleExport}
                                        className="w-full py-4 bg-accent text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(232,255,0,0.15)]"
                                    >
                                        Start Export ({exportFormat.toUpperCase()})
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-5xl space-y-6 mx-auto animate-in fade-in duration-500">
                                <div className="flex items-center justify-between p-4 border border-neutral-800 bg-neutral-900/10">
                                    <div className="flex items-center gap-3">
                                       <Trash className="h-4 w-4 text-neutral-700" />
                                       <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">Archived Records</span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={trash.length === 0}
                                        className="px-4 py-2 border border-red-900/20 bg-red-950/5 text-red-700 text-[10px] font-bold uppercase tracking-widest hover:bg-red-900 hover:text-white disabled:opacity-20 transition-all"
                                        onClick={() => void emptyTrash()}
                                    >
                                        Wipe Recycle Bin
                                    </button>
                                </div>
                                
                                {trash.length === 0 ? (
                                    <div className="border border-dashed border-neutral-900 py-32 text-center text-neutral-800 font-mono text-[10px] uppercase tracking-widest">
                                        Recycle bin is empty
                                    </div>
                                ) : (
                                    trashByCategory.map(([cat, list]) => (
                                        <section key={cat} className="border border-neutral-800 bg-black/20">
                                            <div className="flex items-center justify-between bg-neutral-900/20 border-b border-neutral-800 px-4 py-2">
                                                <h2 className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{cat}</h2>
                                                <button
                                                    type="button"
                                                    className="text-[9px] font-bold uppercase text-neutral-700 hover:text-white transition-colors"
                                                    onClick={() => void restoreCategory(cat)}
                                                >
                                                    Restore Category
                                                </button>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-[11px] font-sans">
                                                    <thead>
                                                        <tr className="border-b border-neutral-900 text-neutral-700 uppercase tracking-wider text-[9px] font-bold">
                                                            <th className="px-4 py-3 font-normal">Station Name</th>
                                                            <th className="px-4 py-3 font-normal">Deletion Date</th>
                                                            <th className="px-4 py-3 text-right font-normal">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-900">
                                                        {list.map((s) => (
                                                            <tr key={s.id} className="hover:bg-neutral-900/10 transition-colors">
                                                                <td className="px-4 py-3 text-neutral-500 font-medium">{s.name}</td>
                                                                <td className="px-4 py-3 text-neutral-700 font-mono text-[9px]">
                                                                    {s.deletedAt ? new Date(s.deletedAt).toLocaleString() : '—'}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <button
                                                                        type="button"
                                                                        className="text-neutral-700 hover:text-white underline underline-offset-4"
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
                </div>
            </div>
        </div>
    )
}
