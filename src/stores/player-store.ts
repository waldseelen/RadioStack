import { create } from 'zustand'
import type { Station } from '@prisma/client'

export type { Station }

export interface PlayerStore {
  currentStation: Station | null
  currentCategoryStations: Station[]
  isPlaying: boolean
  shuffle: boolean
  volume: number
  streamError: boolean
  setStation: (station: Station, categoryStations: Station[]) => void
  next: () => void
  prev: () => void
  togglePlay: () => void
  toggleShuffle: () => void
  setVolume: (v: number) => void
  setStreamError: (err: boolean) => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentStation: null,
  currentCategoryStations: [],
  isPlaying: false,
  shuffle: false,
  volume: 0.85,
  streamError: false,
  setStation: (station, categoryStations) =>
    set({
      currentStation: station,
      currentCategoryStations: categoryStations,
      isPlaying: true,
      streamError: false,
    }),
  next: () => {
    const { currentStation, currentCategoryStations, shuffle } = get()
    if (!currentStation || currentCategoryStations.length === 0) return
    
    let nextIdx: number
    const currentIdx = currentCategoryStations.findIndex((s) => s.id === currentStation.id)

    if (shuffle && currentCategoryStations.length > 1) {
      // Pick a random one that isn't the current one if possible
      do {
        nextIdx = Math.floor(Math.random() * currentCategoryStations.length)
      } while (nextIdx === currentIdx)
    } else {
      nextIdx = (currentIdx + 1) % currentCategoryStations.length
    }

    set({ 
        currentStation: currentCategoryStations[nextIdx], 
        isPlaying: true,
        streamError: false,
    })
  },
  prev: () => {
    const { currentStation, currentCategoryStations, shuffle } = get()
    if (!currentStation || currentCategoryStations.length === 0) return
    
    let prevIdx: number
    const currentIdx = currentCategoryStations.findIndex((s) => s.id === currentStation.id)

    if (shuffle && currentCategoryStations.length > 1) {
      do {
        prevIdx = Math.floor(Math.random() * currentCategoryStations.length)
      } while (prevIdx === currentIdx)
    } else {
      prevIdx = (currentIdx - 1 + currentCategoryStations.length) % currentCategoryStations.length
    }

    set({ 
        currentStation: currentCategoryStations[prevIdx], 
        isPlaying: true,
        streamError: false,
    })
  },
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
  setStreamError: (err) => set({ streamError: err }),
}))
