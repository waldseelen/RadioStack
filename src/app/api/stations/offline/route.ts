import { getDb, serializeDoc } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const snapshot = await db.collection('stations')
            .where('deletedAt', '==', null)
            .where('isLive', '==', false)
            .get()

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
        const msg = e instanceof Error ? e.message : 'Failed to fetch offline stations'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


