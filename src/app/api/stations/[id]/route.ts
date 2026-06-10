import { getDb, serializeDoc } from '@/lib/firebase'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await ctx.params
        const db = getDb()
        const body = await req.json()
        const docRef = db.collection('stations').doc(id)
        const docSnap = await docRef.get()

        if (!docSnap.exists) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const currentData = docSnap.data()!
        if (currentData.deletedAt !== null) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const data: {
            name?: string
            category?: string | null
            isLive?: boolean
            updatedAt?: Date
        } = {}
        if (typeof body.name === 'string') data.name = body.name
        if (body.category !== undefined) {
            data.category =
                typeof body.category === 'string' && body.category.trim()
                    ? body.category.trim()
                    : null
        }
        if (typeof body.isLive === 'boolean') data.isLive = body.isLive

        if (Object.keys(data).length > 0) {
            data.updatedAt = new Date()
            await docRef.update(data)
        }

        const updatedSnap = await docRef.get()
        return NextResponse.json(serializeDoc(updatedSnap))
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Update failed'
        return NextResponse.json({ error: msg }, { status: 400 })
    }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
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
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        const currentData = docSnap.data()!
        if (currentData.deletedAt !== null) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        await docRef.update({
            deletedAt: new Date(),
            updatedAt: new Date()
        })
        return NextResponse.json({ ok: true })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Delete failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


