import { getDb } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ name: string }> }

export async function POST(req: NextRequest, ctx: Ctx) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const db = getDb()
        const { name } = await ctx.params
        const category = decodeURIComponent(name)
        
        const snapshot = await db.collection('stations')
            .where('category', '==', category)
            .where('deletedAt', '!=', null)
            .get()

        if (snapshot.empty) {
            return NextResponse.json({ restored: 0 })
        }

        const batch = db.batch()
        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                deletedAt: null,
                updatedAt: new Date()
            })
        })
        await batch.commit()

        return NextResponse.json({ restored: snapshot.size })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Category restore failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


