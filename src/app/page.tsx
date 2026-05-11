'use client'

import { useState } from 'react'
import { PlayerBar } from '@/components/player-bar'
import { StationBrowser } from '@/components/station-browser'
import { AdminPanel } from '@/components/admin-panel'

export default function Home() {
  const [isAdminOpen, setIsAdminOpen] = useState(false)

  return (
    <main className="mx-auto max-w-7xl px-4 min-h-dvh flex flex-col relative">
      <StationBrowser onOpenSettings={() => setIsAdminOpen(true)} />
      <PlayerBar />

      {isAdminOpen && (
        <AdminPanel onClose={() => setIsAdminOpen(false)} />
      )}
    </main>
  )
}
