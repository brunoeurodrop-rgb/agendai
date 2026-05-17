'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { AlertTriangle, X, CreditCard, Clock, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { differenceInDays } from 'date-fns'

type BannerInfo = {
  tipo: 'trial' | 'expirando' | 'vencido' | 'ativo' | null
  dias?: number
  plano?: string
}

export default function TrialBanner() {
  const [info, setInfo] = useState<BannerInfo>({ tipo: null })
  const [fechado, setFechado] = useState(false)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()
    if (!profile) return

    const { data: org } = await supabase
      .from('organizations')
      .select('plan, trial_ends_at')
      .eq('id', profile.org_id)
      .single()
    if (!org) return

    // Assinante ativo
    if (org.plan === 'starter' || org.plan === 'pro' || org.plan === 'enterprise') {
      setInfo({ tipo: 'ativo', plano: org.plan })
      return
    }

    // Trial
    if (org.trial_ends_at) {
      const dias = differenceInDays(new Date(org.trial_ends_at), new Date())
      if (dias < 0) {
        setInfo({ tipo: 'vencido' })
      } else if (dias <= 5) {
        setInfo({ tipo: 'expirando', dias })
      } else {
        setInfo({ tipo: 'trial', dias })
      }
    }
  }

  if (!info.tipo || fechado) return null

  // Assinante ativo — banner verde discreto
  if (info.tipo === 'ativo') {
    return (
      <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle size={15} />
          Plano <strong className="capitalize">{info.plano}</strong> ativo — obrigado por assinar!
        </div>
        <button onClick={() => setFechado(true)} className="text-emerald-500 hover:text-emerald-700">
          <X size={15} />
        </button>
      </div>
    )
  }

  // Trial vencido — vermelho bloqueante
  if (info.tipo === 'vencido') {
    return (
      <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={16} />
          Seu período gratuito expirou. Assine um plano para continuar usando o AgendaAI.
        </div>
        <Link href="/planos"
          className="bg-white text-red-500 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1.5 shrink-0">
          <CreditCard size={13} /> Assinar agora
        </Link>
      </div>
    )
  }

  // Trial expirando — amarelo de alerta
  if (info.tipo === 'expirando') {
    return (
      <div className="bg-amber-400 text-amber-900 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle size={15} />
          {info.dias === 0
            ? 'Seu período gratuito termina hoje!'
            : `Seu período gratuito termina em ${info.dias} dia${info.dias! > 1 ? 's' : ''}.`}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/planos"
            className="bg-amber-900 text-amber-50 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-800 transition-colors">
            Ver planos
          </Link>
          <button onClick={() => setFechado(true)} className="text-amber-900 hover:text-amber-700">
            <X size={16} />
          </button>
        </div>
      </div>
    )
  }

  // Trial normal — azul informativo
  return (
    <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Clock size={15} />
        Você está no <strong>período gratuito</strong> — {info.dias} dia{info.dias! > 1 ? 's' : ''} restante{info.dias! > 1 ? 's' : ''} de teste.
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/planos"
          className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
          Ver planos
        </Link>
        <button onClick={() => setFechado(true)} className="text-blue-400 hover:text-blue-600">
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
