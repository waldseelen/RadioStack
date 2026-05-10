import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Row = { name: string; streamUrl: string; category: string }

/** Explicit redirects before similarity merge */
const mergeMap: Record<string, string> = {
  Kids: 'General',
  Çocuk: 'General',
  'TV (Video)': 'General',
  General: 'Pop & Hit',
  Genel: 'Pop & Hit',
}

function similarity(a: string, b: string): number {
  const x = a.toLowerCase().normalize('NFD')
  const y = b.toLowerCase().normalize('NFD')
  if (x === y) return 1
  const wa = x.split(/[\s&/,-]+/).filter(Boolean)
  const wb = y.split(/[\s&/,-]+/).filter(Boolean)
  const sa = new Set(wa)
  const sb = new Set(wb)
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter++
  const union = new Set([...sa, ...sb]).size
  if (union === 0) return 0
  const jacc = inter / union
  let prefix = 0
  const m = Math.min(x.length, y.length)
  for (let i = 0; i < m; i++) {
    if (x[i] === y[i]) prefix++
    else break
  }
  const preScore = prefix / Math.max(x.length, y.length, 1)
  return Math.max(jacc, preScore * 0.6)
}

async function mergeCategoriesToMinThree() {
  const MAX_ITERS = 500

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const rows = await prisma.station.findMany({
      where: { deletedAt: null },
      select: { id: true, category: true },
    })

    const byCat = new Map<string, string[]>()
    for (const r of rows) {
      const c = r.category ?? 'Uncategorized'
      if (!byCat.has(c)) byCat.set(c, [])
      byCat.get(c)!.push(r.id)
    }

    const counts = [...byCat.entries()].map(([category, ids]) => ({
      category,
      count: ids.length,
      ids,
    }))

    const small = counts.filter((c) => c.count > 0 && c.count < 3)
    if (small.length === 0) break

    const large = counts.filter((c) => c.count >= 3)
    /** Prefer absorbing into categories that already meet minimum */
    const pickTarget = (from: string): string => {
      const pool =
        large.length > 0
          ? large
          : [...counts].sort((a, b) => b.count - a.count)
      const candidates = pool.filter((p) => p.category !== from)
      if (candidates.length === 0) return 'Pop & Hit'
      const ranked = candidates
        .map((p) => ({ name: p.category, score: similarity(from, p.category) }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      return ranked[0].name
    }

    small.sort((a, b) => a.count - b.count)
    const donor = small[0]
    const target = pickTarget(donor.category)

    await prisma.station.updateMany({
      where: { id: { in: donor.ids }, deletedAt: null },
      data: { category: target },
    })
  }

  const finalGroups = await prisma.station.groupBy({
    by: ['category'],
    where: { deletedAt: null },
    _count: { _all: true },
  })

  const stillSmall = finalGroups.filter(
    (g) => g.category && g._count._all > 0 && g._count._all < 3,
  )
  if (stillSmall.length) {
    const biggest = [...finalGroups].sort(
      (a, b) => b._count._all - a._count._all,
    )[0]
    const sink = biggest?.category ?? 'Pop & Hit'
    for (const g of stillSmall) {
      if (!g.category || g.category === sink) continue
      await prisma.station.updateMany({
        where: { category: g.category, deletedAt: null },
        data: { category: sink },
      })
    }
  }
}

async function applyMergeMap() {
  for (const [from, to] of Object.entries(mergeMap)) {
    await prisma.station.updateMany({
      where: { category: from, deletedAt: null },
      data: { category: to },
    })
  }
}

async function main() {
  const path = join(__dirname, 'stations.json')
  const stations = JSON.parse(readFileSync(path, 'utf-8')) as Row[]

  for (const station of stations) {
    await prisma.station.upsert({
      where: { streamUrl: station.streamUrl },
      update: {
        name: station.name,
        category: station.category,
      },
      create: {
        name: station.name,
        streamUrl: station.streamUrl,
        category: station.category,
        isLive: true,
      },
    })
  }

  console.log(`Seed tamamlandı: ${stations.length} kanal`)

  await applyMergeMap()
  await mergeCategoriesToMinThree()

  const dist = await prisma.station.groupBy({
    by: ['category'],
    where: { deletedAt: null },
    _count: { _all: true },
  })
  console.log(
    'Kategori dağılımı (min 3 kontrol):',
    dist
      .filter((g) => g.category)
      .sort((a, b) => a.category!.localeCompare(b.category!)),
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
