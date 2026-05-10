import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const res = await prisma.station.updateMany({
    where: { id, deletedAt: { not: null } },
    data: { deletedAt: null },
  })
  if (res.count === 0) {
    return NextResponse.json({ error: 'Not found in trash' }, { status: 404 })
  }
  const station = await prisma.station.findUnique({ where: { id } })
  return NextResponse.json(station)
}
