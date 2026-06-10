import { getDb } from '@/lib/firebase'
import { rateLimit } from '@/lib/rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

function clientIp(req: NextRequest): string {
    const fwd = req.headers.get('x-forwarded-for')
    if (fwd) return fwd.split(',')[0]?.trim() ?? 'unknown'
    const real = req.headers.get('x-real-ip')
    if (real) return real
    return req.headers.get('x-vercel-forwarded-for') ?? 'unknown'
}

function parseM3U(text: string): { name: string; streamUrl: string }[] {
    const lines = text.split(/\r?\n/)
    const out: { name: string; streamUrl: string }[] = []
    let pendingName: string | null = null

    for (const raw of lines) {
        const line = raw.trim()
        if (!line) continue
        if (line.startsWith('#EXTINF')) {
            const comma = line.lastIndexOf(',')
            pendingName =
                comma >= 0 ? line.slice(comma + 1).trim() : line.replace(/^#EXTINF:[^,]*,?/i, '').trim()
        } else if (!line.startsWith('#')) {
            const streamUrl = line
            if (/^https?:\/\//i.test(streamUrl)) {
                out.push({
                    name: pendingName?.trim() || 'Unknown station',
                    streamUrl,
                })
            }
            pendingName = null
        }
    }
    return out
}

export async function POST(req: NextRequest) {
    try {
        const decoded = await verifyAuth(req)
        if (!decoded || decoded.email !== 'admin@radiostack.com') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const ip = clientIp(req)
        const lim = rateLimit(`import:${ip}`, 3, 60_000)
        if (!lim.ok) {
            return NextResponse.json(
                { error: 'Rate limited', retryAfterSec: lim.retryAfterSec },
                { status: 429, headers: { 'Retry-After': String(lim.retryAfterSec) } },
            )
        }

        const db = getDb()
        const ct = req.headers.get('content-type') ?? ''
        let text: string
        let defaultCategory: string | null = null

        if (ct.includes('application/json')) {
            const body = await req.json()
            text = typeof body.content === 'string' ? body.content : ''
            defaultCategory =
                typeof body.category === 'string' && body.category.trim()
                    ? body.category.trim()
                    : null
        } else {
            text = await req.text()
        }

        if (!text.trim()) {
            return NextResponse.json({ error: 'Empty M3U body' }, { status: 400 })
        }

        const parsed = parseM3U(text)
        let created = 0
        let updated = 0
        const stationsRef = db.collection('stations')

        for (const row of parsed) {
            const existingSnap = await stationsRef.where('streamUrl', '==', row.streamUrl).get()
            const now = new Date()

            if (!existingSnap.empty) {
                const docRef = existingSnap.docs[0].ref
                await docRef.update({
                    name: row.name,
                    ...(defaultCategory ? { category: defaultCategory } : {}),
                    updatedAt: now,
                })
                updated += 1
            } else {
                await stationsRef.add({
                    name: row.name,
                    streamUrl: row.streamUrl,
                    category: defaultCategory,
                    isLive: true,
                    deletedAt: null,
                    createdAt: now,
                    updatedAt: now,
                })
                created += 1
            }
        }

        return NextResponse.json({ created, updated, total: parsed.length })
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Import failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}


