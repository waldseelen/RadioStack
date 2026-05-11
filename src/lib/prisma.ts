import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }
let prisma: PrismaClient | undefined

function createPrisma(): PrismaClient {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set. Add it to .env.local or Vercel env vars.')
    }
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
}

export function getPrisma(): PrismaClient {
    if (process.env.NODE_ENV === 'production') {
        if (!prisma) prisma = createPrisma()
        return prisma
    }

    if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrisma()
    return globalForPrisma.prisma
}
