'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Heart, MoreVertical, Radio } from 'lucide-react'
import type { Station } from '@prisma/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(station.name)
  const [catOpen, setCatOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

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
      className={cn(
        'relative overflow-visible rounded-lg border border-neutral-800 bg-[#141414] p-3 transition-colors',
        'hover:border-[#e8ff00]',
      )}
    >
      <div ref={menuRef} className="absolute right-2 top-2 z-30">
        <button
          type="button"
          className="rounded p-1 text-[#e8ff00] hover:bg-neutral-800"
          aria-label="Station menu"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen((v) => !v)
            setCatOpen(false)
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 z-40 mt-1 min-w-[200px] rounded-md border border-neutral-700 bg-[#0a0a0a] py-1 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="block w-full px-3 py-2 text-left font-mono text-sm text-[#e8ff00] hover:bg-neutral-900"
              onClick={() => {
                setRenaming(true)
                setMenuOpen(false)
              }}
            >
              Rename
            </button>
            <div className="relative">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left font-mono text-sm text-[#e8ff00] hover:bg-neutral-900"
                onClick={() => setCatOpen((v) => !v)}
              >
                Change Category
              </button>
              {catOpen ? (
                <div className="max-h-48 overflow-auto border-t border-neutral-800">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={cn(
                        'block w-full px-3 py-2 text-left text-sm text-[#e8ff00] hover:bg-neutral-900',
                        station.category === c && 'font-bold',
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
            <button
              type="button"
              className="block w-full px-3 py-2 text-left font-mono text-sm text-[#e8ff00] hover:bg-neutral-900"
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

      <div className="flex gap-3 pr-7">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-[#0a0a0a] hover:border-[#e8ff00]"
        >
          {station.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={station.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <Radio className="h-7 w-7 text-[#e8ff00]" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                className="w-full min-w-0 rounded border border-neutral-600 bg-[#0a0a0a] px-2 py-1 font-sans text-sm text-white outline-none focus:border-[#e8ff00]"
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
                className="shrink-0 text-[#e8ff00]"
                aria-label="Save name"
                onClick={() => saveRename()}
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="w-full text-left"
              onClick={onPlay}
              title={station.name}
            >
              <span className="line-clamp-2 font-sans text-sm font-medium text-white">{station.name}</span>
            </button>
          )}
          {!hideCategoryLabel && station.category ? (
            <p className="mt-1 truncate text-xs text-neutral-500">{station.category}</p>
          ) : null}
        </div>

        <button
          type="button"
          className="mt-1 h-8 w-8 shrink-0 text-[#e8ff00]"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite()
          }}
        >
          {isFavorite ? (
            <Heart className="h-5 w-5 fill-current text-[#e8ff00]" strokeWidth={1.5} />
          ) : (
            <Heart className="h-5 w-5 text-[#e8ff00]" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </div>
  )
}
