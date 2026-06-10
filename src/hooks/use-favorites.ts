'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { db } from '@/lib/firebase-client'
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'
import { toast } from 'sonner'

export const FAVORITES_KEY = 'radyo_favorites'

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([])
  const { user } = useAuthStore()

  // Favorileri senkronize et
  useEffect(() => {
    if (!user) {
      // Giriş yapılmamışsa: localStorage'dan oku
      try {
        const raw = localStorage.getItem(FAVORITES_KEY)
        const parsed: unknown = raw ? JSON.parse(raw) : []
        setIds(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
      } catch {
        setIds([])
      }
      return
    }

    // Giriş yapılmışsa: Firestore ile senkronize et ve yerel favorileri birleştir
    const userDocRef = doc(db, 'users', user.uid)

    const mergeLocalFavorites = async () => {
      try {
        const raw = localStorage.getItem(FAVORITES_KEY)
        if (raw) {
          const localIds: unknown = JSON.parse(raw)
          if (Array.isArray(localIds) && localIds.length > 0) {
            const docSnap = await getDoc(userDocRef)
            let dbIds: string[] = []
            if (docSnap.exists()) {
              dbIds = docSnap.data().favorites || []
            }
            const merged = Array.from(new Set([...dbIds, ...localIds.filter((x): x is string => typeof x === 'string')]))
            await setDoc(userDocRef, { favorites: merged }, { merge: true })
            localStorage.removeItem(FAVORITES_KEY)
            toast.success('Yerel favorileriniz bulut hesabınızla birleştirildi!')
          }
        }
      } catch (err) {
        console.error('Error merging local favorites:', err)
      }
    }

    void mergeLocalFavorites()

    // Firestore değişikliklerini dinle
    const unsubscribe = onSnapshot(userDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        setIds(data.favorites || [])
      } else {
        setIds([])
      }
    }, (error) => {
      console.error('Error listening to favorites:', error)
    })

    return () => unsubscribe()
  }, [user])

  const toggle = useCallback(
    async (id: string) => {
      if (!user) {
        // Giriş yapılmamışsa yerel güncelle
        const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
        setIds(next)
        return
      }

      // Giriş yapılmışsa Firestore güncelle
      const userDocRef = doc(db, 'users', user.uid)
      const isFav = ids.includes(id)
      try {
        if (isFav) {
          await setDoc(userDocRef, { favorites: arrayRemove(id) }, { merge: true })
        } else {
          await setDoc(userDocRef, { favorites: arrayUnion(id) }, { merge: true })
        }
      } catch (err) {
        console.error('Error toggling favorite on cloud:', err)
        toast.error('Bulut favorisi güncellenemedi')
      }
    },
    [ids, user],
  )

  const isFavorite = useCallback((id: string) => ids.includes(id), [ids])

  const set = useMemo(
    () => ({
      ids,
      toggle,
      isFavorite,
    }),
    [ids, toggle, isFavorite],
  )

  return set
}
