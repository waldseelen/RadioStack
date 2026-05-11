import { getPrisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ name: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
    try {
        const prisma = getPrisma()
        const { name } = await ctx.params
        const category = decodeURIComponent(name)
        const res = await prisma.station.updateMany({
            where: { category, deletedAt: { not: null } },
            data: { deletedAt: null },
        })
        return NextResponse.json({ restored: res.count })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Category restore failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
