'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, addDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Wallet, TrendingUp, Clock, QrCode, Banknote, CreditCard, AlertCircle } from 'lucide-react'

const TZ = 'America/Sao_Paulo'

const PAYMENT_METHODS = [
  { id: 'pix', label: 'Pix', icon: QrCode, color: 'text-teal-600', bg: 'bg-teal-50' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 'cartao_debito', label: 'Cartão Débito', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 'cartao_credito', label: 'Cartão Crédito', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50' },
]

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true)
  const [recebido, setRecebido] = useState(0)
  const [porFormaPagamento, setPorFormaPagamento] = useState<Record<string, number>>({})
  const [aReceber7, setAReceber7] = useState(0)
  const [aReceber30, setAReceber30] = useState(0)
  const [qtdAtendimentos, setQtdAtendimentos] = useState(0)
  const [qtdAReceber7, setQtdAReceber7] = useState(0)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const today = new Date()
    const monthStart = startOfMonth(today)
    const monthEnd = endOfMonth(today)
    const todayEnd = endOfDay(today)
    const next7 = addDays(today, 7)
    const next30 = addDays(today, 30)

    const [completedRes, receber7Res, receber30Res] = await Promise.all([
      // Recebido no mês (concluídos)
      supabase
        .from('appointments')
        .select('payment_method, service:services(price)')
        .gte('starts_at', monthStart.toISOString())
        .lte('starts_at', monthEnd.toISOString())
        .eq('status', 'completed'),
      // A receber nos próximos 7 dias (confirmados, futuro)
      supabase
        .from('appointments')
        .select('service:services(price)')
        .gt('starts_at', todayEnd.toISOString())
        .lte('starts_at', next7.toISOString())
        .eq('status', 'confirmed'),
      // A receber nos próximos 30 dias
      supabase
        .from('appointments')
        .select('service:services(price)')
        .gt('starts_at', todayEnd.toISOString())
        .lte('starts_at', next30.toISOString())
        .eq('status', 'confirmed'),
    ])

    const completed = completedRes.data || []
    const receber7 = receber7Res.data || []
    const receber30 = receber30Res.data || []

    // Total recebido
    const totalRecebido = completed.reduce((s, a: any) => s + (a.service?.price || 0), 0)
    setRecebido(totalRecebido)
    setQtdAtendimentos(completed.length)

    // Por forma de pagamento
    const porForma: Record<string, number> = {}
    completed.forEach((a: any) => {
      const method = a.payment_method || 'nao_informado'
      porForma[method] = (porForma[method] || 0) + (a.service?.price || 0)
    })
    setPorFormaPagamento(porForma)

    // A receber
    setAReceber7(receber7.reduce((s, a: any) => s + (a.service?.price || 0), 0))
    setQtdAReceber7(receber7.length)
    setAReceber30(receber30.reduce((s, a: any) => s + (a.service?.price || 0), 0))

    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  const totalPorForma = Object.values(porFormaPagamento).reduce((s, v) => s + v, 0)
  const naoInformado = porFormaPagamento['nao_informado'] || 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-50 p-1.5 rounded-lg"><Wallet size={15} className="text-emerald-600" /></div>
            <span className="text-xs text-gray-500">Recebido no mês</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">R${recebido.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{qtdAtendimentos} atendimento{qtdAtendimentos !== 1 ? 's' : ''} concluído{qtdAtendimentos !== 1 ? 's' : ''}</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-amber-50 p-1.5 rounded-lg"><Clock size={15} className="text-amber-600" /></div>
            <span className="text-xs text-gray-500">A receber (7 dias)</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">R${aReceber7.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{qtdAReceber7} agendamento{qtdAReceber7 !== 1 ? 's' : ''} confirmado{qtdAReceber7 !== 1 ? 's' : ''}</div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-50 p-1.5 rounded-lg"><TrendingUp size={15} className="text-blue-600" /></div>
            <span className="text-xs text-gray-500">A receber (30 dias)</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">R${aReceber30.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">Previsão total do mês</div>
        </div>
      </div>

      {/* Aviso sobre previsão */}
      <div className="flex items-start gap-2 mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span>Os valores "a receber" são uma <strong>previsão</strong> baseada em agendamentos confirmados. Cancelamentos e faltas reduzem esse valor.</span>
      </div>

      {/* Divisão por forma de pagamento */}
      <div className="card">
        <h2 className="font-medium text-gray-900 mb-4 text-sm">Recebido por forma de pagamento</h2>

        {totalPorForma === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhum pagamento registrado este mês ainda.
          </div>
        ) : (
          <div className="space-y-4">
            {PAYMENT_METHODS.map(pm => {
              const valor = porFormaPagamento[pm.id] || 0
              const pct = totalPorForma > 0 ? (valor / totalPorForma) * 100 : 0
              if (valor === 0) return null
              return (
                <div key={pm.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`${pm.bg} p-1 rounded`}><pm.icon size={13} className={pm.color} /></div>
                      <span className="text-sm text-gray-700">{pm.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900">R${valor.toFixed(2)}</span>
                      <span className="text-xs text-gray-400 ml-2">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pm.id === 'pix' ? 'bg-teal-500' : pm.id === 'dinheiro' ? 'bg-green-500' : pm.id === 'cartao_debito' ? 'bg-blue-500' : 'bg-purple-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}

            {naoInformado > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Sem forma de pagamento informada</span>
                  <span className="font-medium text-gray-500">R${naoInformado.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
