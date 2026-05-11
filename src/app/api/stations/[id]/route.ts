import { getPrisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
    const { id } = await ctx.params
    try {
        const prisma = getPrisma()
        const body = await req.json()
        const data: {
            name?: string
            category?: string | null
            isLive?: boolean
        } = {}
        if (typeof body.name === 'string') data.name = body.name
        if (body.category !== undefined) {
            data.category =
                typeof body.category === 'string' && body.category.trim()
                    ? body.category.trim()
                    : null
        }
        if (typeof body.isLive === 'boolean') data.isLive = body.isLive

        const station = await prisma.station.updateMany({
            where: { id, deletedAt: null },
            data,
        })
        if (station.count === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        const updated = await prisma.station.findUnique({ where: { id } })
        return NextResponse.json(updated)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Update failed'
        return NextResponse.json({ error: msg }, { status: 400 })
    }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
    try {
        const prisma = getPrisma()
        const { id } = await ctx.params
        const res = await prisma.station.updateMany({
            where: { id, deletedAt: null },
            data: { deletedAt: new Date() },
        })
        if (res.count === 0) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
