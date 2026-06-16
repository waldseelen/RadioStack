'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { db } from '@/lib/firebase-client'
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { toast } from 'sonner'

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([])
  const { user } = useAuthStore()

  useEffect(() => {
    if (!user) {
      setIds([])
      return
    }

    const userDocRef = doc(db, 'users', user.uid)
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
        toast.error('Favorilere eklemek için giriş yapmalısınız')
        return
      }

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
