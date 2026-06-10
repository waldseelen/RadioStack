import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import * as admin from 'firebase-admin'

// Initialize firebase admin
const projectId = process.env.FIREBASE_PROJECT_ID || 'radiostack-dev-67a8'
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY

if (clientEmail && privateKey) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  })
} else {
  const localKeyPath = join(__dirname, '../firebase-service-account.json')
  if (existsSync(localKeyPath)) {
    const localKey = JSON.parse(readFileSync(localKeyPath, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(localKey),
    })
  } else {
    admin.initializeApp({ projectId })
  }
}

const db = admin.firestore()

type Row = { name: string; streamUrl: string; category: string }

/** Explicit redirects before similarity merge */
const mergeMap: Record<string, string> = {
  Kids: 'General',
  Çocuk: 'General',
  'TV (Video)': 'General',
  General: 'Pop & Hit',
  Genel: 'Pop & Hit',
}

function similarity(a: string, b: string): number {
  const x = a.toLowerCase().normalize('NFD')
  const y = b.toLowerCase().normalize('NFD')
  if (x === y) return 1
  const wa = x.split(/[\s&/,-]+/).filter(Boolean)
  const wb = y.split(/[\s&/,-]+/).filter(Boolean)
  const sa = new Set(wa)
  const sb = new Set(wb)
  let inter = 0
  for (const w of sa) if (sb.has(w)) inter++
  const union = new Set([...sa, ...sb]).size
  if (union === 0) return 0
  const jacc = inter / union
  let prefix = 0
  const m = Math.min(x.length, y.length)
  for (let i = 0; i < m; i++) {
    if (x[i] === y[i]) prefix++
    else break
  }
  const preScore = prefix / Math.max(x.length, y.length, 1)
  return Math.max(jacc, preScore * 0.6)
}

async function mergeCategoriesToMinThree() {
  const MAX_ITERS = 500
  const stationsRef = db.collection('stations')

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    const snapshot = await stationsRef.where('deletedAt', '==', null).get()
    const rows = snapshot.docs.map(doc => ({ id: doc.id, category: doc.data().category }))

    const byCat = new Map<string, string[]>()
    for (const r of rows) {
      const c = r.category ?? 'Uncategorized'
      if (!byCat.has(c)) byCat.set(c, [])
      byCat.get(c)!.push(r.id)
    }

    const counts = [...byCat.entries()].map(([category, ids]) => ({
      category,
      count: ids.length,
      ids,
    }))

    const small = counts.filter((c) => c.count > 0 && c.count < 3)
    if (small.length === 0) break

    const large = counts.filter((c) => c.count >= 3)
    /** Prefer absorbing into categories that already meet minimum */
    const pickTarget = (from: string): string => {
      const pool =
        large.length > 0
          ? large
          : [...counts].sort((a, b) => b.count - a.count)
      const candidates = pool.filter((p) => p.category !== from)
      if (candidates.length === 0) return 'Pop & Hit'
      const ranked = candidates
        .map((p) => ({ name: p.category, score: similarity(from, p.category) }))
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      return ranked[0].name
    }

    small.sort((a, b) => a.count - b.count)
    const donor = small[0]
    const target = pickTarget(donor.category)

    const batch = db.batch()
    donor.ids.forEach((id) => {
      batch.update(stationsRef.doc(id), { category: target, updatedAt: new Date() })
    })
    await batch.commit()
  }

  // Final check for still small categories
  const snapshot = await stationsRef.where('deletedAt', '==', null).get()
  const rows = snapshot.docs.map(doc => ({ id: doc.id, category: doc.data().category }))

  const byCat = new Map<string, number>()
  for (const r of rows) {
    const c = r.category ?? 'Uncategorized'
    byCat.set(c, (byCat.get(c) || 0) + 1)
  }

  const stillSmall = [...byCat.entries()].filter(
    ([category, count]) => category && count > 0 && count < 3
  )

  if (stillSmall.length) {
    const biggest = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]
    const sink = biggest ? biggest[0] : 'Pop & Hit'
    
    const batch = db.batch()
    let batchCount = 0

    for (const [cat] of stillSmall) {
      if (!cat || cat === sink) continue
      const toMove = snapshot.docs.filter(doc => doc.data().category === cat)
      toMove.forEach(doc => {
        batch.update(doc.ref, { category: sink, updatedAt: new Date() })
        batchCount++
      })
    }
    if (batchCount > 0) {
      await batch.commit()
    }
  }
}

async function applyMergeMap() {
  const stationsRef = db.collection('stations')
  for (const [from, to] of Object.entries(mergeMap)) {
    const snapshot = await stationsRef
      .where('category', '==', from)
      .where('deletedAt', '==', null)
      .get()

    if (!snapshot.empty) {
      const batch = db.batch()
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { category: to, updatedAt: new Date() })
      })
      await batch.commit()
    }
  }
}

async function main() {
  const path = join(__dirname, 'stations.json')
  const stations = JSON.parse(readFileSync(path, 'utf-8')) as Row[]
  const stationsRef = db.collection('stations')

  console.log(`Seeding started: ${stations.length} stations...`)

  for (const station of stations) {
    const existingSnap = await stationsRef.where('streamUrl', '==', station.streamUrl).get()
    const now = new Date()

    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update({
        name: station.name,
        category: station.category,
        updatedAt: now,
      })
    } else {
      await stationsRef.add({
        name: station.name,
        streamUrl: station.streamUrl,
        category: station.category,
        isLive: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  console.log(`Seed loaded successfully in Firestore!`)

  await applyMergeMap()
  await mergeCategoriesToMinThree()

  // Get final category distribution
  const snapshot = await stationsRef.where('deletedAt', '==', null).get()
  const distMap = new Map<string, number>()
  snapshot.docs.forEach(doc => {
    const cat = doc.data().category || 'Uncategorized'
    distMap.set(cat, (distMap.get(cat) || 0) + 1)
  })

  console.log(
    'Kategori dağılımı (min 3 kontrol):',
    [...distMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, count]) => ({ category, count }))
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
