import { getPrisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ name: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
    try {
        const prisma = getPrisma()
        const { name } = await ctx.params
        const category = decodeURIComponent(name)
        const now = new Date()
        const res = await prisma.station.updateMany({
            where: { category, deletedAt: null },
            data: { deletedAt: now },
        })
        return NextResponse.json({ softDeleted: res.count })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Category delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
