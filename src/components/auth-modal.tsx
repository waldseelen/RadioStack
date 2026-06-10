'use client'

import { useState } from 'react'
import { auth } from '@/lib/firebase-client'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { toast } from 'sonner'
import { X, Lock, Mail, UserPlus, LogIn } from 'lucide-react'

interface AuthModalProps {
  onClose: () => void
}

export function AuthModal({ onClose }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Lütfen tüm alanları doldurun.')
      return
    }
    setLoading(true)
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password)
        toast.success('Kayıt başarılı! Giriş yapıldı.')
      } else {
        await signInWithEmailAndPassword(auth, email, password)
        toast.success('Giriş başarılı!')
      }
      onClose()
    } catch (err: unknown) {
      console.error(err)
      let msg = 'Bir hata oluştu.'
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          msg = 'Geçersiz e-posta veya şifre.'
        } else if (code === 'auth/email-already-in-use') {
          msg = 'Bu e-posta adresi zaten kullanımda.'
        } else if (code === 'auth/weak-password') {
          msg = 'Şifre en az 6 karakter olmalıdır.'
        }
      }
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-black border border-neutral-800 shadow-2xl overflow-hidden relative p-8">
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white transition-colors"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header Title */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-neutral-900 p-3 border border-neutral-800 mb-3 text-accent shadow-[0_0_10px_rgba(232,255,0,0.1)]">
            {isRegister ? <UserPlus className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-200">
            {isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
          </h2>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mt-1.5 text-center">
            {isRegister ? 'Favorilerinizi bulutta saklamak için kaydolun' : 'Favorilerinize her cihazdan erişin'}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-neutral-600 block">E-Posta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
              <input 
                type="email" 
                required
                placeholder="ornek@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 bg-neutral-950 border border-neutral-800 focus:border-accent pl-10 pr-4 text-xs text-neutral-300 outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-neutral-600 block">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-600" />
              <input 
                type="password" 
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 bg-neutral-950 border border-neutral-800 focus:border-accent pl-10 pr-4 text-xs text-neutral-300 outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 bg-accent text-black text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(232,255,0,0.1)]"
          >
            {loading ? 'İşleniyor...' : isRegister ? 'Hesap Oluştur' : 'Giriş Yap'}
          </button>
        </form>

        {/* Toggle Register/Login */}
        <div className="mt-6 pt-4 border-t border-neutral-900 text-center">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 hover:text-accent transition-colors"
            type="button"
          >
            {isRegister ? 'Zaten hesabınız var mı? Giriş Yap' : 'Hesabınız yok mu? Yeni Hesap Aç'}
          </button>
        </div>

      </div>
    </div>
  )
}
