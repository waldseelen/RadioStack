import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ name: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { name } = await ctx.params
  const category = decodeURIComponent(name)
  const now = new Date()
  const res = await prisma.station.updateMany({
    where: { category, deletedAt: null },
    data: { deletedAt: now },
  })
  return NextResponse.json({ softDeleted: res.count })
}
