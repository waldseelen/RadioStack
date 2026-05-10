import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ name: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params
  const category = decodeURIComponent(name)
  const res = await prisma.station.updateMany({
    where: { category, deletedAt: { not: null } },
    data: { deletedAt: null },
  })
  return NextResponse.json({ restored: res.count })
}
