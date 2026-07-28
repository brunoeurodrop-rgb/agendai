'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { AlertCircle, CheckCircle, Shield, X } from 'lucide-react'
import Link from 'next/link'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

type BannerState = 'admin' | 'ativo' | 'trial' | 'expirando' | 'vencido' | null

export default function TrialBanner() {
  const [state, setState] = useState<BannerState>(null)
  const [diasRestantes, setDiasRestantes] = useState<number | null>(null)
  const [plano, setPlano] = useState<string>('')
  const [dismissed, setDismissed] = useState(false)
  const supabase = createClient()

  useEffect(() => { check() }, [])

  async function check() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (user.email === ADMIN_EMAIL) { setState('admin'); return }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return

    const { data: org } = await supabase
      .from('organizations')
      .select('plan, trial_ends_at, stripe_subscription_id, stripe_current_period_end')
      .eq('id', profile.org_id)
      .single()

    if (!org) return
    setPlano(org.plan)

    const now = new Date()

    // Plano pago com assinatura Stripe ativa
    if (org.stripe_subscription_id && org.stripe_current_period_end) {
      const periodEnd = new Date(org.stripe_current_period_end)
      if (periodEnd > now) {
        const dias = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        setDiasRestantes(dias)
        if (dias <= 7) { setState('expirando'); return }
        setState('ativo')
        return
      } else {
        setState('vencido')
        return
      }
    }

    // Plano pago sem Stripe (definido manualmente)
    if (['starter', 'pro', 'enterprise'].includes(org.plan) && !org.stripe_subscription_id) {
      if (org.trial_ends_at) {
        const trialEnd = new Date(org.trial_ends_at)
        const dias = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        if (dias < 0) { setState('vencido'); return }
        if (dias <= 7) { setDiasRestantes(dias); setState('expirando'); return }
      }
      setState('ativo')
      return
    }

    // Trial
    if (org.plan === 'trial') {
      if (!org.trial_ends_at) { setState('vencido'); return }
      const trialEnd = new Date(org.trial_ends_at)
      const dias = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (dias < 0) { setState('vencido'); return }
      setDiasRestantes(dias)
      if (dias <= 5) { setState('expirando'); return }
      setState('trial')
      return
    }

    setState('ativo')
  }

  const PLANO_LABEL: Record<string, string> = {
    trial: 'Trial', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise'
  }

  if (!state || dismissed) return null

  if (state === 'admin') return (
    <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-amber-700">
        <Shield size={13} className="shrink-0" />
        <span><strong>Modo Administrador</strong> — você tem acesso total ao sistema.</span>
      </div>
      <Link href="/admin" className="text-amber-700 font-semibold hover:underline shrink-0">Painel Admin →</Link>
    </div>
  )

  if (state === 'ativo') return (
    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 text-xs flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle size={13} className="shrink-0" />
        <span>Plano <strong>{PLANO_LABEL[plano] || plano}</strong> ativo — obrigado por assinar! 🎉</span>
      </div>
      <button onClick={() => setDismissed(true)} className="text-emerald-400 hover:text-emerald-600"><X size={13} /></button>
    </div>
  )

  if (state === 'vencido') return (
    <div className="bg-red-500 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="shrink-0" />
        <span>Seu período expirou. Assine um plano para continuar usando o AgendaAI.</span>
      </div>
      <Link href="/planos" className="bg-white text-red-600 font-semibold text-xs px-3 py-1.5 rounded-lg shrink-0 hover:bg-red-50">
        Assinar agora
      </Link>
    </div>
  )

  if (state === 'expirando') return (
    <div className="bg-amber-500 text-white px-4 py-2.5 text-sm flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <AlertCircle size={15} className="shrink-0" />
        <span>Seu plano expira em <strong>{diasRestantes} dia{diasRestantes !== 1 ? 's' : ''}</strong>. Renove para não perder o acesso.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/planos" className="bg-white text-amber-600 font-semibold text-xs px-3 py-1.5 rounded-lg hover:bg-amber-50">Renovar</Link>
        <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white"><X size={15} /></button>
      </div>
    </div>
  )

  if (state === 'trial') return (
    <div className="bg-brand text-white px-4 py-2.5 text-sm flex items-center justify-between gap-4">
      <span>Período gratuito — <strong>{diasRestantes} dia{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}</strong>. Aproveite tudo!</span>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/planos" className="bg-white text-brand font-semibold text-xs px-3 py-1.5 rounded-lg">Assinar agora</Link>
        <button onClick={() => setDismissed(true)} className="text-white/70 hover:text-white"><X size={15} /></button>
      </div>
    </div>
  )

  return null
}
