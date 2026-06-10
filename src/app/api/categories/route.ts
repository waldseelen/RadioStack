import { getDb } from '@/lib/firebase'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const db = getDb()
        const snapshot = await db.collection('stations')
            .where('deletedAt', '==', null)
            .get()

        const categoriesSet = new Set<string>()
        snapshot.docs.forEach((doc) => {
            const cat = doc.data().category
            if (typeof cat === 'string' && cat.trim()) {
                categoriesSet.add(cat.trim())
            }
        })

        const names = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b))
        return NextResponse.json(names)
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch categories'
        console.error('GET /api/categories error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

