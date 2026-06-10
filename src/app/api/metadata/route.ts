import { NextRequest, NextResponse } from 'next/server'
import http from 'http'
import https from 'https'
import { URL } from 'url'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const streamUrl = req.nextUrl.searchParams.get('url')
    if (!streamUrl) {
        return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    return new Promise<Response>((resolve) => {
        try {
            const parsedUrl = new URL(streamUrl)

            const lib = parsedUrl.protocol === 'https:' ? https : http

            const options = {
                headers: {
                    'Icy-MetaData': '1',
                    'User-Agent': 'RadioStackMetadataParser/1.0'
                },
                timeout: 5000 // 5 saniye zaman aşımı
            }

            const request = lib.get(streamUrl, options, (res) => {
                const metaintStr = res.headers['icy-metaint']
                
                // Eğer sunucu metadata desteği sunmuyorsa bağlantıyı kapat ve boş dön
                if (!metaintStr) {
                    res.destroy()
                    resolve(NextResponse.json({ title: null, artist: null, raw: null }))
                    return
                }

                const metaint = parseInt(metaintStr as string, 10)
                let bytesRead = 0
                let metadataBuffer = Buffer.alloc(0)
                let isReadingMetadata = false
                let metadataSize = 0

                res.on('data', (chunk: Buffer) => {
                    let offset = 0
                    while (offset < chunk.length) {
                        if (!isReadingMetadata) {
                            const needed = metaint - bytesRead
                            const available = chunk.length - offset
                            if (available < needed) {
                                bytesRead += available
                                break
                            } else {
                                offset += needed
                                bytesRead = 0
                                isReadingMetadata = true
                                if (offset < chunk.length) {
                                    const lengthByte = chunk[offset]
                                    metadataSize = lengthByte * 16
                                    offset++
                                    if (metadataSize === 0) {
                                        isReadingMetadata = false
                                    }
                                }
                            }
                        } else {
                            const available = chunk.length - offset
                            const needed = metadataSize - metadataBuffer.length
                            if (available < needed) {
                                metadataBuffer = Buffer.concat([metadataBuffer, chunk.subarray(offset)])
                                break
                            } else {
                                metadataBuffer = Buffer.concat([metadataBuffer, chunk.subarray(offset, offset + needed)])
                                offset += needed
                                
                                // Akıştan metadata bilgisini başarıyla okuduk, bağlantıyı kesebiliriz
                                const metadataStr = metadataBuffer.toString('utf8')
                                res.destroy()
                                
                                // StreamTitle='Sanatçı - Şarkı Adı'; formatını ayrıştır
                                const match = metadataStr.match(/StreamTitle='([^']*)'/)
                                if (match && match[1]) {
                                    const titleAndArtist = match[1]
                                    const parts = titleAndArtist.split(' - ')
                                    const artist = parts[0]?.trim() || null
                                    const title = parts.slice(1).join(' - ')?.trim() || null
                                    
                                    resolve(NextResponse.json({
                                        title: title || titleAndArtist,
                                        artist: artist || 'Bilinmeyen Sanatçı',
                                        raw: metadataStr
                                    }))
                                } else {
                                    resolve(NextResponse.json({ title: null, artist: null, raw: metadataStr }))
                                }
                                return
                            }
                        }
                    }
                })

                res.on('error', (err) => {
                    console.error('Stream response error:', err)
                    res.destroy()
                    resolve(NextResponse.json({ error: err.message }, { status: 500 }))
                })
            })

            request.on('error', (err) => {
                console.error('Request error:', err)
                resolve(NextResponse.json({ error: err.message }, { status: 500 }))
            })

            request.on('timeout', () => {
                request.destroy()
                resolve(NextResponse.json({ error: 'Request timeout' }, { status: 504 }))
            })

        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Metadata fetch failed'
            console.error('Metadata fetch failed:', e)
            resolve(NextResponse.json({ error: msg }, { status: 500 }))
        }
    })
}

