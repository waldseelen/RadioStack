import Link from 'next/link'
import { PlayerBar } from '@/components/player-bar'
import { StationBrowser } from '@/components/station-browser'

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin"
          className="font-mono text-sm text-[#e8ff00] underline-offset-4 hover:underline"
        >
          Admin
        </Link>
      </div>
      <StationBrowser />
      <PlayerBar />
    </main>
  )
}
