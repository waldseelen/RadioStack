import { getDb } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ name: string }> }

export async function DELETE(req: NextRequest, ctx: Ctx) {
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
            .where('deletedAt', '==', null)
            .get()

        if (snapshot.empty) {
            return NextResponse.json({ softDeleted: 0 })
        }

        const now = new Date()
        const batch = db.batch()
        snapshot.docs.forEach((doc) => {
            batch.update(doc.ref, {
                deletedAt: now,
                updatedAt: now
            })
        })
        await batch.commit()

        return NextResponse.json({ softDeleted: snapshot.size })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Category delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


