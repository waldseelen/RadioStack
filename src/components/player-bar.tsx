'use client'

import { useEffect, useRef } from 'react'
import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { usePlayerStore } from '@/stores/player-store'
import { cn } from '@/lib/utils'

export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const {
    currentStation,
    isPlaying,
    volume,
    togglePlay,
    setVolume,
    next,
    prev,
  } = usePlayerStore()

  useEffect(() => {
    const el = audioRef.current
    if (!el || !currentStation) return
    el.volume = volume
    const url = currentStation.streamUrl
    if (el.src !== url) {
      el.src = url
      el.load()
    }
    if (isPlaying) {
      const p = el.play()
      if (p && typeof p.then === 'function') p.catch(() => undefined)
    } else {
      el.pause()
    }
  }, [currentStation, isPlaying, volume])

  if (!currentStation) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-[#141414] px-3"
      style={{ maxHeight: 72 }}
    >
      <audio ref={audioRef} className="hidden" />
      <div className="mx-auto flex max-w-6xl items-center gap-3 py-2" style={{ maxHeight: 72 }}>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-700 text-[#e8ff00] hover:border-[#e8ff00]"
          aria-label="Previous station"
          onClick={() => prev()}
        >
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e8ff00] text-[#0a0a0a] hover:bg-[#e8ff00]"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => togglePlay()}
        >
          {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-neutral-700 text-[#e8ff00] hover:border-[#e8ff00]"
          aria-label="Next station"
          onClick={() => next()}
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate font-mono text-sm text-[#e8ff00]">{currentStation.name}</p>
          {currentStation.category ? (
            <p className="truncate text-xs text-neutral-400">{currentStation.category}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Volume2 className="h-4 w-4 text-neutral-400" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={cn(
              'h-1 w-24 cursor-pointer accent-[#e8ff00]',
              'appearance-none bg-neutral-700',
            )}
          />
        </div>
      </div>
    </div>
  )
}
