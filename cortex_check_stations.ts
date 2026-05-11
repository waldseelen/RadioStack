const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const CONCURRENCY = 20

interface Result {
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
      return { name: s.name, url: s.streamUrl, status: 'ONLINE' }
    } else {
      return { name: s.name, url: s.streamUrl, status: 'OFFLINE', reason: res.status }
    }
  } catch (e) {
    const error = e as any
    const msg = error.name === 'AbortError' ? 'TIMEOUT' : error.message || 'ERROR'
    return { name: s.name, url: s.streamUrl, status: 'OFFLINE', reason: msg }
  }
}

async function checkStations() {
  console.log('Fetching stations...')
  const stations = await prisma.station.findMany({ where: { deletedAt: null } })
  console.log(`Testing ${stations.length} stations with concurrency ${CONCURRENCY}...\n`)
  
  const results: Result[] = []
  const queue = [...stations]
  let active = 0
  let finished = 0

  return new Promise((resolve) => {
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
  }).then(async (allResults: any) => {
    const resultsArray = allResults as Result[]
    console.log('\n--- SCAN COMPLETE ---')
    const offline = resultsArray.filter((r) => r.status === 'OFFLINE')
    console.log(`Summary: ${resultsArray.length} total, ${offline.length} offline.\n`)
    
    if (offline.length > 0) {
      console.log('OFFLINE STATIONS:')
      offline.forEach((r) => console.log(`- ${r.name} (${r.reason})`))
      
      console.log('\nMarking them as offline in the database...')
      const offlineUrls = offline.map((r) => r.url)
      await prisma.station.updateMany({
          where: { streamUrl: { in: offlineUrls } },
          data: { isLive: false }
      })
      console.log('Database updated.')
    }
    await prisma.$disconnect()
  })
}

checkStations()
