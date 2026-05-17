'use client'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'

const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 'R$49',
    desc: 'Ideal para comecar',
    featured: false,
    priceId: 'price_1TXq9q3NsfHF8KhTMJDkvNWw',
    features: ['1 profissional', 'Agenda online', 'WhatsApp basico', '50 agendamentos/mes', 'Suporte por e-mail'],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$99',
    desc: 'Para negocios em crescimento',
    featured: true,
    priceId: 'price_1TXqA53NsfHF8KhTFHn3X7US',
    features: ['Ate 5 profissionais', 'WhatsApp ilimitado', 'IA de atendimento', 'PIX automatico', 'Google Agenda', 'Agendamentos ilimitados', 'Relatorios avancados', 'Suporte prioritario'],
  },
  {
    id: 'enterprise',
    nome: 'Enterprise',
    preco: 'R$249',
    desc: 'Multi-unidades e franquias',
    featured: false,
    priceId: 'price_1TXqAP3NsfHF8KhTgB4woG5a',
    features: ['Profissionais ilimitados', 'Multiplas unidades', 'API personalizada', 'Relatorios completos', 'Suporte dedicado', 'Onboarding exclusivo'],
  },
]

export default function PlanosPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  async function assinar(priceId: string, planId: string) {
    setLoading(planId)
    try {
      // Pegar o token JWT da sessao atual
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Faca login novamente para assinar.')
        setLoading(null)
        return
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error('Erro: ' + (data.error || 'Tente novamente.'))
        setLoading(null)
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error('Erro ao iniciar checkout.')
        setLoading(null)
      }
    } catch (err) {
      toast.error('Erro de conexao. Verifique sua internet.')
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">Planos e assinatura</h1>
        <p className="text-sm text-gray-500 mt-1">14 dias gratis em qualquer plano. Sem cartao de credito.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {PLANOS.map(p => (
          <div key={p.nome} className={`rounded-2xl p-6 border bg-white ${p.featured ? 'border-brand border-2 relative' : 'border-gray-200'}`}>
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">
                Mais popular
              </div>
            )}
            <div className="mb-5">
              <div className="font-bold text-gray-900 text-base mb-1">{p.nome}</div>
              <div className="text-3xl font-bold text-gray-900">{p.preco}<span className="text-sm font-normal text-gray-400">/mes</span></div>
              <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
            </div>
            <div className="space-y-2.5 mb-6">
              {p.features.map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <Check size={15} className="text-brand shrink-0" />{f}
                </div>
              ))}
            </div>
            <button
              onClick={() => assinar(p.priceId, p.id)}
              disabled={!!loading}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                p.featured
                  ? 'bg-brand text-white hover:bg-brand-dark disabled:opacity-60'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60'
              }`}
            >
              {loading === p.id && <Loader2 size={14} className="animate-spin" />}
              {loading === p.id ? 'Aguarde...' : p.id === 'enterprise' ? 'Falar com vendas' : `Assinar ${p.nome}`}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-gray-400">
        Todos os planos incluem atualizacoes gratuitas e suporte via WhatsApp.
      </p>
    </div>
  )
}
