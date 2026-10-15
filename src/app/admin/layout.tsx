'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, LogOut, Home, RefreshCw } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [userName, setUserName] = useState('')

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/dashboard')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', user.id).single()
    setUserName(profile?.name || user.email || '')
    setChecking(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Verificando acesso...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Shield size={14} className="text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-white">Admin</span>
            <span className="text-gray-600">/</span>
            <span className="text-sm text-gray-400 font-medium">Está Agendado</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{userName}</span>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <Home size={13} /> App
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
            >
              <LogOut size={13} /> Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
