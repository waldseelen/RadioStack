import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const stations = await prisma.station.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
  })
  return NextResponse.json(stations)
}

export async function DELETE() {
  const res = await prisma.station.deleteMany({
    where: { deletedAt: { not: null } },
  })
  return NextResponse.json({ deleted: res.count })
}
