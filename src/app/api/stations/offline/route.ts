import { getPrisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const prisma = getPrisma()
        const stations = await prisma.station.findMany({
            where: {
                deletedAt: null,
                isLive: false,
            },
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        })

        return NextResponse.json(stations)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch offline stations'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
