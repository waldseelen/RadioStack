export interface Station {
    id: string
    name: string
    streamUrl: string
    logo?: string | null
    category?: string | null
    isLive: boolean
    deletedAt?: string | null
    createdAt?: string
    updatedAt?: string
}
