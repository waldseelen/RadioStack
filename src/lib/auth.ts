import { getDb } from './firebase'
import * as admin from 'firebase-admin'

/**
 * Gelen HTTP isteğindeki Authorization başlığından Firebase ID belirtecini (token) 
 * çıkarır ve firebase-admin SDK kullanarak doğrular.
 * 
 * @param req Gelen Request nesnesi
 * @returns Doğrulanmış kullanıcı belirteç bilgisi (DecodedIdToken) veya null
 */
export async function verifyAuth(req: Request): Promise<admin.auth.DecodedIdToken | null> {
    try {
        // Firebase Admin SDK'nın başlatıldığından emin ol
        getDb()
        
        const authHeader = req.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null
        }
        
        const token = authHeader.split(' ')[1]
        if (!token) {
            return null
        }
        
        const decodedToken = await admin.auth().verifyIdToken(token)
        return decodedToken
    } catch (error) {
        console.error('Auth verification failed:', error)
        return null
    }
}
