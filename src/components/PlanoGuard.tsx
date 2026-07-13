'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Lock } from 'lucide-react'
import Link from 'next/link'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

const PLANO_NIVEL: Record<string, number> = {
  trial: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
}

interface Props {
  planoMinimo: 'starter' | 'pro'
  children: React.ReactNode
  mensagem?: string
}

export default function PlanoGuard({ planoMinimo, children, mensagem }: Props) {
  const [loading, setLoading] = useState(true)
  const [temAcesso, setTemAcesso] = useState(false)
  const [planoAtual, setPlanoAtual] = useState<string>('trial')
  const supabase = createClient()

  useEffect(() => { check() }, [])

  async function check() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // Admin tem acesso a tudo
    if (user.email === ADMIN_EMAIL) { setTemAcesso(true); setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) { setLoading(false); return }

    const { data: org } = await supabase.from('organizations').select('plan').eq('id', profile.org_id).single()
    const plano = org?.plan || 'trial'
    setPlanoAtual(plano)
    setTemAcesso(PLANO_NIVEL[plano] >= PLANO_NIVEL[planoMinimo])
    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
  )

  if (!temAcesso) return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Lock size={28} className="text-gray-400" />
      </div>
      <h2 className="font-semibold text-gray-900 mb-2">
        Disponível no plano {planoMinimo === 'starter' ? 'Starter' : 'Pro'}
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        {mensagem || `Esta funcionalidade está disponível a partir do plano ${planoMinimo === 'starter' ? 'Starter' : 'Pro'}. Faça upgrade para continuar.`}
      </p>
      <div className="flex flex-col items-center gap-3">
        <Link href="/planos" className="btn-primary px-8">
          Ver planos e fazer upgrade
        </Link>
        <p className="text-xs text-gray-400">
          Seu plano atual: <strong className="capitalize">{planoAtual}</strong>
        </p>
      </div>
    </div>
  )

  return <>{children}</>
}
