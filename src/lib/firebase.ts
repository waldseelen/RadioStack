import * as admin from 'firebase-admin'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { Station } from '../types/station'

export function getDb(): admin.firestore.Firestore {
    if (admin.apps.length === 0) {
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
            // Check if service account file exists locally
            const localKeyPath = join(process.cwd(), 'firebase-service-account.json')
            if (existsSync(localKeyPath)) {
                try {
                    const localKey = JSON.parse(readFileSync(localKeyPath, 'utf8'))
                    admin.initializeApp({
                        credential: admin.credential.cert(localKey),
                    })
                } catch (e) {
                    console.error('Failed to parse firebase-service-account.json:', e)
                    admin.initializeApp({ projectId })
                }
            } else {
                // Default credential initialization (emulator, GCP environment, etc.)
                admin.initializeApp({ projectId })
            }
        }
    }
    return admin.firestore()
}

export function serializeDoc(doc: admin.firestore.DocumentSnapshot): Station {
    const data = doc.data()
    if (!data) {
        throw new Error(`Document ${doc.id} contains no data`)
    }
    return {
        id: doc.id,
        name: data.name || '',
        streamUrl: data.streamUrl || '',
        logo: data.logo || null,
        category: data.category || null,
        isLive: data.isLive !== false,
        deletedAt: data.deletedAt
            ? typeof data.deletedAt.toDate === 'function'
                ? data.deletedAt.toDate().toISOString()
                : new Date(data.deletedAt).toISOString()
            : null,
        createdAt: data.createdAt
            ? typeof data.createdAt.toDate === 'function'
                ? data.createdAt.toDate().toISOString()
                : new Date(data.createdAt).toISOString()
            : undefined,
        updatedAt: data.updatedAt
            ? typeof data.updatedAt.toDate === 'function'
                ? data.updatedAt.toDate().toISOString()
                : new Date(data.updatedAt).toISOString()
            : undefined,
    }
}
