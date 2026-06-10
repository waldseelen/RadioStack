import { getDb, serializeDoc } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
    try {
        const db = getDb()
        const cat = req.nextUrl.searchParams.get('category')
        
        let query = db.collection('stations')
            .where('deletedAt', '==', null)
            .where('isLive', '==', true)

        if (cat && cat !== 'Favorites') {
            query = query.where('category', '==', cat)
        }

        const snapshot = await query.get()
        const stations = snapshot.docs.map(serializeDoc)

        stations.sort((a, b) => {
            const catA = a.category || ''
            const catB = b.category || ''
            const catCompare = catA.localeCompare(catB)
            if (catCompare !== 0) return catCompare
            return a.name.localeCompare(b.name)
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
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
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

        const stationsRef = db.collection('stations')
        const existingSnap = await stationsRef.where('streamUrl', '==', streamUrl).get()
        if (!existingSnap.empty) {
            return NextResponse.json(
                { error: 'A station with this stream URL already exists' },
                { status: 400 },
            )
        }

        const now = new Date()
        const docRef = await stationsRef.add({
            name,
            streamUrl,
            category,
            logo,
            isLive: true,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
        })
        const docSnap = await docRef.get()
        return NextResponse.json(serializeDoc(docSnap))
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Create failed'
        return NextResponse.json({ error: msg }, { status: 400 })
    }
}


