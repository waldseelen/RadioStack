import { getPrisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const prisma = getPrisma()
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
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch categories'
        console.error('GET /api/categories error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
