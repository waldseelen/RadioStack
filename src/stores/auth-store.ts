import { create } from 'zustand'
import { User, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase-client'

export interface AuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
  idToken: string | null
  init: () => () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAdmin: false,
  idToken: null,
  init: () => {
    // Firebase Auth dinleyicisi
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true) // force refresh token
          const isAdmin = firebaseUser.email === 'admin@radiostack.com'
          set({ user: firebaseUser, idToken, isAdmin, loading: false })
        } catch (e) {
          console.error("Failed to get ID token:", e)
          set({ user: firebaseUser, idToken: null, isAdmin: false, loading: false })
        }
      } else {
        set({ user: null, idToken: null, isAdmin: false, loading: false })
      }
    })
    return unsubscribe
  },
  logout: async () => {
    set({ loading: true })
    try {
      await signOut(auth)
    } catch (e) {
      console.error("Logout failed:", e)
    } finally {
      set({ user: null, idToken: null, isAdmin: false, loading: false })
    }
  }
}))
