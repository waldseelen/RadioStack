import { getPrisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const prisma = getPrisma()
        const stations = await prisma.station.findMany({
            where: { deletedAt: { not: null } },
            orderBy: { deletedAt: 'desc' },
        })
        return NextResponse.json(stations)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch trash'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function DELETE() {
    try {
        const prisma = getPrisma()
        const res = await prisma.station.deleteMany({
            where: { deletedAt: { not: null } },
        })
        return NextResponse.json({ deleted: res.count })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Trash delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
