import { create } from 'zustand'
import type { Station } from '@prisma/client'

export type { Station }

export interface PlayerStore {
  currentStation: Station | null
  currentCategoryStations: Station[]
  isPlaying: boolean
  volume: number
  setStation: (station: Station, categoryStations: Station[]) => void
  next: () => void
  prev: () => void
  togglePlay: () => void
  setVolume: (v: number) => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentStation: null,
  currentCategoryStations: [],
  isPlaying: false,
  volume: 0.85,
  setStation: (station, categoryStations) =>
    set({
      currentStation: station,
      currentCategoryStations: categoryStations,
      isPlaying: true,
    }),
  next: () => {
    const { currentStation, currentCategoryStations } = get()
    if (!currentStation || currentCategoryStations.length === 0) return
    const idx = currentCategoryStations.findIndex((s) => s.id === currentStation.id)
    const i = idx < 0 ? 0 : (idx + 1) % currentCategoryStations.length
    set({ currentStation: currentCategoryStations[i], isPlaying: true })
  },
  prev: () => {
    const { currentStation, currentCategoryStations } = get()
    if (!currentStation || currentCategoryStations.length === 0) return
    const idx = currentCategoryStations.findIndex((s) => s.id === currentStation.id)
    const i =
      idx < 0
        ? 0
        : (idx - 1 + currentCategoryStations.length) % currentCategoryStations.length
    set({ currentStation: currentCategoryStations[i], isPlaying: true })
  },
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)) }),
}))
