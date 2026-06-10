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
            .where('deletedAt', '!=', null)
            .orderBy('deletedAt', 'desc')
            .get()
        const stations = snapshot.docs.map(serializeDoc)
        return NextResponse.json(stations)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch trash'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const snapshot = await db.collection('stations')
            .where('deletedAt', '!=', null)
            .get()

        const batch = db.batch()
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref)
        })
        await batch.commit()

        return NextResponse.json({ deleted: snapshot.size })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Trash delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


