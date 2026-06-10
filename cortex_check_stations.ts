const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

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
  const localKeyPath = path.join(__dirname, 'firebase-service-account.json')
  if (fs.existsSync(localKeyPath)) {
    const localKey = JSON.parse(fs.readFileSync(localKeyPath, 'utf8'))
    admin.initializeApp({
      credential: admin.credential.cert(localKey),
    })
  } else {
    admin.initializeApp({ projectId })
  }
}

const db = admin.firestore()
const CONCURRENCY = 20

interface Result {
  id: string;
  name: string;
  url: string;
  status: string;
  reason?: string | number;
}

async function testStation(s: any, i: number, total: number): Promise<Result> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    
    let res
    try {
        res = await fetch(s.streamUrl, { 
            method: 'HEAD',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
    } catch (e) {
        // Fallback to GET if HEAD fails or is not supported
        res = await fetch(s.streamUrl, { 
            method: 'GET',
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        })
    }
    
    clearTimeout(timeoutId)
    
    if (res.ok || res.status < 400) {
      return { id: s.id, name: s.name, url: s.streamUrl, status: 'ONLINE' }
    } else {
      return { id: s.id, name: s.name, url: s.streamUrl, status: 'OFFLINE', reason: res.status }
    }
  } catch (e) {
    const error = e as any
    const msg = error.name === 'AbortError' ? 'TIMEOUT' : error.message || 'ERROR'
    return { id: s.id, name: s.name, url: s.streamUrl, status: 'OFFLINE', reason: msg }
  }
}

async function checkStations() {
  console.log('Fetching stations from Firestore...')
  const snapshot = await db.collection('stations').where('deletedAt', '==', null).get()
  const stations = snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
  }))
  console.log(`Testing ${stations.length} stations with concurrency ${CONCURRENCY}...\n`)
  
  const results: Result[] = []
  const queue = [...stations]
  let active = 0
  let finished = 0

  return new Promise<Result[]>((resolve) => {
    const next = async () => {
      if (queue.length === 0 && active === 0) {
        resolve(results)
        return
      }

      while (active < CONCURRENCY && queue.length > 0) {
        const s = queue.shift()
        active++
        testStation(s, results.length, stations.length).then(res => {
          results.push(res)
          active--
          finished++
          if (finished % 25 === 0 || finished === stations.length) {
              console.log(`Progress: ${finished}/${stations.length} (${Math.round(finished/stations.length*100)}%)`)
          }
          next()
        })
      }
    }
    next()
  }).then(async (resultsArray) => {
    console.log('\n--- SCAN COMPLETE ---')
    const offline = resultsArray.filter((r) => r.status === 'OFFLINE')
    console.log(`Summary: ${resultsArray.length} total, ${offline.length} offline.\n`)
    
    if (offline.length > 0) {
      console.log('OFFLINE STATIONS:')
      offline.forEach((r) => console.log(`- ${r.name} (${r.reason})`))
      
      console.log('\nMarking them as offline in the database...')
      const stationsRef = db.collection('stations')
      const batch = db.batch()
      
      offline.forEach((r) => {
          batch.update(stationsRef.doc(r.id), { isLive: false, updatedAt: new Date() })
      })
      await batch.commit()
      console.log('Database updated.')
    }
  })
}

checkStations()
  .catch(console.error)
