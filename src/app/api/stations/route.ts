import { getPrisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
    try {
        const prisma = getPrisma()
        const cat = req.nextUrl.searchParams.get('category')
        const where: {
            deletedAt: null
            isLive: boolean
            category?: string
        } = { deletedAt: null, isLive: true }
        if (cat && cat !== 'Favorites') {
            where.category = cat
        }

        const stations = await prisma.station.findMany({
            where,
            orderBy: [{ category: 'asc' }, { name: 'asc' }],
        })

        return NextResponse.json(stations)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch stations'
        console.error('GET /api/stations error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const prisma = getPrisma()
        const body = await req.json()
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const streamUrl = typeof body.streamUrl === 'string' ? body.streamUrl.trim() : ''
        const category =
            typeof body.category === 'string' && body.category.trim()
                ? body.category.trim()
                : null
        const logo = typeof body.logo === 'string' ? body.logo.trim() || null : null

        if (!name || !streamUrl) {
            return NextResponse.json(
                { error: 'name and streamUrl are required' },
                { status: 400 },
            )
        }

        const station = await prisma.station.create({
            data: {
                name,
                streamUrl,
                category,
                logo,
                isLive: true,
            },
        })
        return NextResponse.json(station)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Create failed'
        return NextResponse.json({ error: msg }, { status: 400 })
    }
}
