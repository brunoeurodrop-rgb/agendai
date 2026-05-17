'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

export default function AssinaturaSucessoPage() {
  const router = useRouter()
  useEffect(() => {
    const t = setTimeout(() => router.push('/dashboard'), 5000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-brand" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Assinatura confirmada!</h1>
        <p className="text-gray-500 text-sm mb-6">Seu plano foi ativado. Redirecionando para o painel em 5 segundos...</p>
        <Link href="/dashboard" className="btn-primary inline-block px-8 py-3">Ir para o painel</Link>
      </div>
    </div>
  )
}
