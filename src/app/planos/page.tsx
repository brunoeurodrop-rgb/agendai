'use client'
import { useState } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase-client'
import toast from 'react-hot-toast'

const PLANOS = [
  {
    id: 'starter',
    nome: 'Starter',
    preco: 'R$49,90',
    desc: 'Ideal para começar',
    featured: false,
    priceId: 'price_1TXq9q3NsfHF8KhTMJDkvNWw',
    features: [
      '1 profissional',
      'Clientes ilimitados',
      'Serviços ilimitados',
      'Até 50 agendamentos/mês',
      'Agenda online',
      'WhatsApp automático',
      'Confirmação, lembrete, cancelamento e reagendamento automáticos',
      'Dashboard e relatórios básicos',
      'Suporte via WhatsApp',
    ],
  },
  {
    id: 'pro',
    nome: 'Pro',
    preco: 'R$99,90',
    desc: 'Para negócios em crescimento',
    featured: true,
    priceId: 'price_1TXqA53NsfHF8KhTFHn3X7US',
    features: [
      'Tudo do Starter, e mais:',
      'Até 5 profissionais',
      'Até 500 agendamentos/mês',
      'Gestão de comissões',
      'Relatórios avançados + Export PDF',
      'Dashboard financeiro completo',
      'Estatísticas avançadas de WhatsApp',
      'Campanhas de WhatsApp (aniversário, clientes inativos)',
      'Importação de clientes via Excel',
      'Suporte prioritário',
    ],
  },
]

const ADICIONAIS = [
  { nome: 'Profissional extra', preco: 'R$14,90/mês', desc: 'Adicione mais profissionais sem trocar de plano' },
  { nome: 'Pacote +200 agendamentos', preco: 'R$19,90/mês', desc: 'Para quem está crescendo rápido' },
  { nome: 'Configuração Assistida', preco: 'R$79,90 único', desc: 'Conectamos seu WhatsApp por você' },
]

export default function PlanosPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const supabase = createClient()

  async function assinar(priceId: string, planId: string) {
    setLoading(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Faça login novamente para assinar.')
        setLoading(null)
        return
      }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
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
    } catch {
      toast.error('Erro de conexão. Verifique sua internet.')
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">Planos e assinatura</h1>
        <p className="text-sm text-gray-500 mt-1">14 dias grátis em qualquer plano. Sem cartão de crédito.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {PLANOS.map(p => (
          <div key={p.nome} className={`rounded-2xl p-6 border bg-white ${p.featured ? 'border-brand border-2 relative' : 'border-gray-200'}`}>
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-medium px-4 py-1 rounded-full whitespace-nowrap">
                Mais popular
              </div>
            )}
            <div className="mb-5">
              <div className="font-bold text-gray-900 text-base mb-1">{p.nome}</div>
              <div className="text-3xl font-bold text-gray-900">{p.preco}<span className="text-sm font-normal text-gray-400">/mês</span></div>
              <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
            </div>
            <div className="space-y-2.5 mb-6">
              {p.features.map(f => (
                <div key={f} className={`flex items-center gap-2 text-sm ${f.startsWith('Tudo do') ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                  {!f.startsWith('Tudo do') && <Check size={15} className="text-brand shrink-0" />}
                  {f}
                </div>
              ))}
            </div>
            <button
              onClick={() => assinar(p.priceId, p.id)}
              disabled={!!loading}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                p.featured ? 'bg-brand text-white hover:bg-brand-dark disabled:opacity-60' : 'border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60'
              }`}
            >
              {loading === p.id && <Loader2 size={14} className="animate-spin" />}
              {loading === p.id ? 'Aguarde...' : `Assinar ${p.nome}`}
            </button>
          </div>
        ))}
      </div>

      {/* Serviços adicionais */}
      <div className="max-w-2xl mx-auto mt-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-brand" /> Recursos adicionais
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {ADICIONAIS.map(a => (
            <div key={a.nome} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="font-medium text-sm text-gray-900 mb-1">{a.nome}</div>
              <div className="text-brand font-bold text-sm mb-1">{a.preco}</div>
              <div className="text-xs text-gray-400">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Enterprise sob consulta */}
      <div className="max-w-2xl mx-auto mt-4">
        <div className="rounded-2xl p-6 border border-dashed border-gray-300 bg-gray-50 text-center">
          <div className="font-bold text-gray-700 mb-1">Precisa de mais?</div>
          <p className="text-sm text-gray-500 mb-4">
            Para redes com múltiplas unidades ou volume alto de atendimentos, temos uma solução personalizada.
          </p>
          <a
            href="https://wa.me/5521990760217?text=Olá%2C+tenho+interesse+em+um+plano+personalizado+do+AgendaAI"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-6 py-2.5 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Falar com consultor
          </a>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Todos os planos incluem atualizações gratuitas e suporte via WhatsApp.
      </p>
    </div>
  )
}
