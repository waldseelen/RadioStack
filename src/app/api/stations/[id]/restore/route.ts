import { getDb, serializeDoc } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const { id } = await ctx.params
        const docRef = db.collection('stations').doc(id)
        const docSnap = await docRef.get()

        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Not found in trash' }, { status: 404 })
        }

        const currentData = docSnap.data()!
        if (currentData.deletedAt === null) {
            return NextResponse.json({ error: 'Not found in trash' }, { status: 404 })
        }

        await docRef.update({
            deletedAt: null,
            updatedAt: new Date()
        })

        const updatedSnap = await docRef.get()
        return NextResponse.json(serializeDoc(updatedSnap))
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Restore failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


