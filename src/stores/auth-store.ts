import { create } from 'zustand'
import { User, onAuthStateChanged, signOut } from 'firebase/auth'
import { auth, db } from '@/lib/firebase-client'
import { doc, onSnapshot } from 'firebase/firestore'

export interface AuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
  pendingApproval: boolean
  idToken: string | null
  init: () => () => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  isAdmin: false,
  pendingApproval: false,
  idToken: null,
  init: () => {
    let unsubscribeDoc: (() => void) | null = null;
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }
      
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true) // force refresh token
          const isAdmin = firebaseUser.email === 'admin@radiostack.com'
          
          if (!isAdmin) {
             unsubscribeDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
                if (docSnap.exists()) {
                   const data = docSnap.data();
                   const isApproved = data.approved === true;
                   set({ user: firebaseUser, idToken, isAdmin, pendingApproval: !isApproved, loading: false })
                } else {
                   set({ user: firebaseUser, idToken, isAdmin, pendingApproval: true, loading: false })
                }
             });
          } else {
             set({ user: firebaseUser, idToken, isAdmin, pendingApproval: false, loading: false })
          }
          
        } catch (e) {
          console.error("Failed to get ID token:", e)
          set({ user: firebaseUser, idToken: null, isAdmin: false, pendingApproval: false, loading: false })
        }
      } else {
        set({ user: null, idToken: null, isAdmin: false, pendingApproval: false, loading: false })
      }
    })
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    }
  },
  logout: async () => {
    set({ loading: true })
    try {
      await signOut(auth)
    } catch (e) {
      console.error("Logout failed:", e)
    } finally {
      set({ user: null, idToken: null, isAdmin: false, pendingApproval: false, loading: false })
    }
  }
}))
