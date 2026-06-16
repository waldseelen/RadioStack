import { NextResponse } from 'next/server'
import { getDb, getAdminAuth } from '@/lib/firebase'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const token = authHeader.split('Bearer ')[1]
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)

    // Sadece admin yetkili
    if (decoded.email !== 'admin@radiostack.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { uid } = await params;
    const body = await request.json()
    const { approved } = body

    if (typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // Custom Claim ayarla
    const currentClaims = (await adminAuth.getUser(uid)).customClaims || {}
    await adminAuth.setCustomUserClaims(uid, { ...currentClaims, approved })

    // Firestore dokümanını güncelle
    const db = getDb()
    await db.collection('users').doc(uid).update({
      approved,
      updatedAt: new Date()
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error in user approval:', e)
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 })
  }
}
