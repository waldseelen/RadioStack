'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Heart, MoreHorizontal, Radio, Play, Pause, AlertCircle } from 'lucide-react'
import type { Station } from '@prisma/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePlayerStore } from '@/stores/player-store'

type Props = {
  station: Station
  categories: string[]
  hideCategoryLabel?: boolean
  isFavorite: boolean
  onToggleFavorite: () => void
  onPlay: () => void
  onRename: (name: string) => Promise<void>
  onChangeCategory: (category: string | null) => Promise<void>
  onSoftDelete: () => Promise<void>
  onMarkOffline?: () => Promise<void>
  searchQuery?: string
  isSelected?: boolean
  onSelect?: (selected: boolean) => void
}

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <span>{text}</span>
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return (
        <span>
            {parts.map((part, i) => 
                part.toLowerCase() === query.toLowerCase() 
                    ? <mark key={i} className="bg-accent text-black px-0.5">{part}</mark> 
                    : part
            )}
        </span>
    )
}

export function StationCard({
  station,
  categories,
  hideCategoryLabel,
  isFavorite,
  onToggleFavorite,
  onPlay,
  onRename,
  onChangeCategory,
  onSoftDelete,
  onMarkOffline,
  searchQuery = '',
  isSelected = false,
  onSelect,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(station.name)
  const [catOpen, setCatOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  
  const currentStation = usePlayerStore((s) => s.currentStation)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const streamError = usePlayerStore((s) => s.streamError)
  const isActive = currentStation?.id === station.id

  useEffect(() => {
    setNameDraft(station.name)
  }, [station.name])

  useEffect(() => {
    if (!menuOpen && !catOpen) return
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setCatOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [menuOpen, catOpen])

  const saveRename = async () => {
    const next = nameDraft.trim()
    if (!next || next === station.name) {
      setRenaming(false)
      return
    }
    try {
      await onRename(next)
    } catch {
      setNameDraft(station.name)
    }
    setRenaming(false)
  }

  return (
    <div
      id={`station-${station.id}`}
      className={cn(
        'group relative flex items-center gap-3 border border-neutral-800 bg-[#0a0a0a] p-2 transition-all',
        'hover:bg-neutral-900',
        isActive ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : '',
        isSelected ? 'bg-accent/10 border-accent/40' : ''
      )}
    >
      {/* Selection Checkbox */}
      <div 
        className={cn(
            "flex items-center justify-center w-5 h-5 border transition-all cursor-pointer",
            isSelected ? "bg-accent border-accent" : "border-neutral-800 group-hover:border-neutral-700 bg-black"
        )}
        onClick={() => onSelect?.(!isSelected)}
      >
        {isSelected && <Check className="h-3.5 w-3.5 text-black" strokeWidth={4} />}
      </div>

      {/* Play/Pause Button Area */}
      <button
        type="button"
        onClick={onPlay}
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center border border-neutral-800 bg-black transition-colors hover:border-accent",
          isActive ? "border-accent" : ""
        )}
      >
        {station.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={station.logo} alt="" className="h-full w-full object-cover opacity-80 grayscale transition-all group-hover:grayscale-0 group-hover:opacity-100" />
        ) : (
          <Radio className="h-4 w-4 text-neutral-500" />
        )}
        
        {/* Play Overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center bg-black/60 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}>
          {isActive && isPlaying ? (
            <Pause className="h-4 w-4 text-white" />
          ) : (
            <Play className="h-4 w-4 text-white ml-0.5" />
          )}
        </div>

        {/* Error Status */}
        {isActive && streamError && (
            <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5 border border-black animate-pulse">
                <AlertCircle className="h-2.5 w-2.5 text-white" />
            </div>
        )}
      </button>

      {/* Text Content */}
      <div className="min-w-0 flex-1 py-1">
        {renaming ? (
          <div className="flex items-center gap-2">
            <input
              className="w-full min-w-0 border-b border-neutral-500 bg-transparent px-1 py-0.5 font-sans text-sm text-white outline-none focus:border-white"
              value={nameDraft}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter') await saveRename()
                if (e.key === 'Escape') {
                  setNameDraft(station.name)
                  setRenaming(false)
                }
              }}
            />
            <button
              type="button"
              className="shrink-0 text-neutral-400 hover:text-white"
              aria-label="Save name"
              onClick={() => saveRename()}
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col justify-center h-full leading-tight">
            <button
              type="button"
              className="w-full text-left"
              onClick={onPlay}
            >
              <span className={cn(
                "line-clamp-1 font-sans text-sm font-medium transition-colors",
                isActive ? "text-accent" : "text-neutral-300 group-hover:text-accent"
              )}>
                <Highlight text={station.name} query={searchQuery} />
              </span>
            </button>
            {!hideCategoryLabel && (station.category || isActive) ? (
              <div className="flex items-center gap-2 mt-0.5 overflow-hidden">
                {station.category && (
                    <p className="truncate font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        <Highlight text={station.category} query={searchQuery} />
                    </p>
                )}
                {isActive && streamError && (
                    <span className="shrink-0 font-mono text-[9px] text-red-500 uppercase font-bold animate-pulse">OFFLINE</span>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 pr-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
        <button
          type="button"
          className="p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          {isFavorite ? (
            <Heart className="h-3.5 w-3.5 fill-accent text-accent" strokeWidth={2} />
          ) : (
            <Heart className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </button>

        {/* Station Menu */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className="p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white"
            aria-label="Station menu"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
              setCatOpen(false)
            }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 bottom-full z-40 mb-1 min-w-[160px] border border-neutral-800 bg-[#0a0a0a] py-1 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left font-sans text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                onClick={() => {
                  setRenaming(true)
                  setMenuOpen(false)
                }}
              >
                Rename
              </button>
              <div className="relative border-t border-neutral-800">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left font-sans text-xs text-neutral-300 hover:bg-neutral-800 hover:text-white"
                  onClick={() => setCatOpen((v) => !v)}
                >
                  Change Category
                </button>
                {catOpen ? (
                  <div className="max-h-48 overflow-auto border-t border-neutral-800 bg-black">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={cn(
                          'block w-full px-3 py-1.5 text-left font-sans text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white',
                          station.category === c && 'font-medium text-white',
                        )}
                        onClick={async () => {
                          try {
                            await onChangeCategory(c)
                            setCatOpen(false)
                            setMenuOpen(false)
                          } catch {
                            toast.error('Could not update category')
                          }
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {onMarkOffline && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left font-sans text-xs text-orange-400 hover:bg-orange-950 hover:text-orange-300 border-t border-neutral-800"
                    onClick={async () => {
                      setMenuOpen(false)
                      try {
                        await onMarkOffline()
                      } catch {
                        toast.error('Could not mark as offline')
                      }
                    }}
                  >
                    Mark Offline
                  </button>
              )}
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left font-sans text-xs text-red-400 hover:bg-red-950 hover:text-red-300 border-t border-neutral-800"
                onClick={async () => {
                  setMenuOpen(false)
                  try {
                    await onSoftDelete()
                  } catch {
                    toast.error('Could not delete')
                  }
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
