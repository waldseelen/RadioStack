import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const groups = await prisma.station.groupBy({
    by: ['category'],
    where: { deletedAt: null, category: { not: null } },
    _count: { _all: true },
  })
  const names = groups
    .map((g) => g.category)
    .filter((c): c is string => Boolean(c))
    .sort((a, b) => a.localeCompare(b))
  return NextResponse.json(names)
}
