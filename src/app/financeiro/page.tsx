'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Wallet, TrendingUp, Clock, QrCode, Banknote, CreditCard, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react'

const PAYMENT_METHODS = [
  { id: 'pix',           label: 'Pix',           icon: QrCode,     color: 'text-teal-600',   bg: 'bg-teal-50',   bar: 'bg-teal-500'   },
  { id: 'dinheiro',      label: 'Dinheiro',       icon: Banknote,   color: 'text-green-600',  bg: 'bg-green-50',  bar: 'bg-green-500'  },
  { id: 'cartao_debito', label: 'Cartão Débito',  icon: CreditCard, color: 'text-blue-600',   bg: 'bg-blue-50',   bar: 'bg-blue-500'   },
  { id: 'cartao_credito',label: 'Cartão Crédito', icon: CreditCard, color: 'text-purple-600', bg: 'bg-purple-50', bar: 'bg-purple-500' },
]

function getMonthRange(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const start = new Date(`${y}-${m}-01T00:00:00-03:00`).toISOString()
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate()
  const end = new Date(`${y}-${m}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`).toISOString()
  return { start, end }
}

interface MonthData {
  label: string
  recebido: number
  agendado: number
}

export default function FinanceiroPage() {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [recebido, setRecebido] = useState(0)
  const [agendado, setAgendado] = useState(0)
  const [porFormaPagamento, setPorFormaPagamento] = useState<Record<string, number>>({})
  const [aReceber7, setAReceber7] = useState(0)
  const [aReceber30, setAReceber30] = useState(0)
  const [qtdConcluidos, setQtdConcluidos] = useState(0)
  const [qtdAReceber7, setQtdAReceber7] = useState(0)
  const [historico, setHistorico] = useState<MonthData[]>([])
  const supabase = createClient()

  useEffect(() => { loadAll() }, [selectedMonth])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadMonth(), loadHistorico(), loadAReceber()])
    setLoading(false)
  }

  async function loadMonth() {
    const { start, end } = getMonthRange(selectedMonth)

    const { data: completed } = await supabase
      .from('appointments')
      .select('payment_method, service:services(price)')
      .gte('starts_at', start)
      .lte('starts_at', end)
      .eq('status', 'completed')

    const { data: notCancelled } = await supabase
      .from('appointments')
      .select('service:services(price)')
      .gte('starts_at', start)
      .lte('starts_at', end)
      .not('status', 'eq', 'cancelled')

    const all = completed || []
    const totalRecebido = all.reduce((s, a: any) => s + (a.service?.price || 0), 0)
    const totalAgendado = (notCancelled || []).reduce((s, a: any) => s + (a.service?.price || 0), 0)

    setRecebido(totalRecebido)
    setAgendado(totalAgendado)
    setQtdConcluidos(all.length)

    const porForma: Record<string, number> = {}
    all.forEach((a: any) => {
      const method = a.payment_method || 'nao_informado'
      porForma[method] = (porForma[method] || 0) + (a.service?.price || 0)
    })
    setPorFormaPagamento(porForma)
  }

  async function loadAReceber() {
    const today = new Date()
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const todayEnd = new Date(`${todayStr}T23:59:59-03:00`).toISOString()
    const next7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const next30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const [r7, r30] = await Promise.all([
      supabase.from('appointments').select('service:services(price)')
        .gt('starts_at', todayEnd).lte('starts_at', next7).eq('status', 'confirmed'),
      supabase.from('appointments').select('service:services(price)')
        .gt('starts_at', todayEnd).lte('starts_at', next30).eq('status', 'confirmed'),
    ])

    setAReceber7((r7.data || []).reduce((s, a: any) => s + (a.service?.price || 0), 0))
    setQtdAReceber7(r7.data?.length || 0)
    setAReceber30((r30.data || []).reduce((s, a: any) => s + (a.service?.price || 0), 0))
  }

  async function loadHistorico() {
    const months: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const { start, end } = getMonthRange(date)
      const label = format(date, 'MMM', { locale: ptBR })

      const [completed, notCancelled] = await Promise.all([
        supabase.from('appointments').select('service:services(price)')
          .gte('starts_at', start).lte('starts_at', end).eq('status', 'completed'),
        supabase.from('appointments').select('service:services(price)')
          .gte('starts_at', start).lte('starts_at', end).not('status', 'eq', 'cancelled'),
      ])

      months.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        recebido: (completed.data || []).reduce((s, a: any) => s + (a.service?.price || 0), 0),
        agendado: (notCancelled.data || []).reduce((s, a: any) => s + (a.service?.price || 0), 0),
      })
    }
    setHistorico(months)
  }

  const maxHistorico = Math.max(...historico.map(m => m.agendado), 1)
  const totalPorForma = Object.values(porFormaPagamento).reduce((s, v) => s + v, 0)
  const naoInformado = porFormaPagamento['nao_informado'] || 0
  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500 mt-0.5">Acompanhe receitas e previsões</p>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-gray-900 text-sm">Evolução dos últimos 6 meses</h2>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-sm bg-brand-light inline-block"></span> Agendado
            <span className="w-3 h-3 rounded-sm bg-brand inline-block ml-2"></span> Recebido
          </div>
        </div>

        {/* Gráfico de barras */}
        <div className="flex items-end gap-3 h-32 mb-2">
          {historico.map((m, i) => {
            const isSelected = m.label === format(selectedMonth, 'MMM', { locale: ptBR }).charAt(0).toUpperCase() + format(selectedMonth, 'MMM', { locale: ptBR }).slice(1)
            const hAgendado = Math.round((m.agendado / maxHistorico) * 100)
            const hRecebido = Math.round((m.recebido / maxHistorico) * 100)
            return (
              <button key={i} onClick={() => setSelectedMonth(subMonths(new Date(), 5 - i))}
                className={`flex-1 flex flex-col items-center gap-1 group`}>
                <div className="w-full flex items-end gap-1 h-28">
                  <div className="flex-1 rounded-t-lg transition-all"
                    style={{ height: `${hAgendado}%`, background: isSelected ? '#00C896' : '#E8F9F4' }} />
                  <div className="flex-1 rounded-t-lg transition-all"
                    style={{ height: `${hRecebido}%`, background: isSelected ? '#009E76' : '#C8F0E4' }} />
                </div>
                <span className={`text-xs font-medium ${isSelected ? 'text-brand' : 'text-gray-400'}`}>{m.label}</span>
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-4 justify-between pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Clique em um mês para filtrar os dados abaixo</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
            <span className="text-sm font-medium text-gray-900 min-w-[130px] text-center capitalize">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button onClick={() => setSelectedMonth(m => addMonths(m, 1))}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-50 p-1.5 rounded-lg"><Wallet size={15} className="text-emerald-600" /></div>
            <span className="text-xs text-gray-500">Recebido no mês</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">R${recebido.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{qtdConcluidos} atendimento{qtdConcluidos !== 1 ? 's' : ''} concluído{qtdConcluidos !== 1 ? 's' : ''}</div>
        </div>

        {isCurrentMonth ? (
          <>
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
              <div className="text-xs text-gray-400 mt-1">Previsão total</div>
            </div>
          </>
        ) : (
          <div className="card col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-brand-light p-1.5 rounded-lg"><TrendingUp size={15} className="text-brand" /></div>
              <span className="text-xs text-gray-500">Total agendado no mês</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">R${agendado.toFixed(2)}</div>
            <div className="text-xs text-gray-400 mt-1">Realizados + confirmados (exceto cancelados)</div>
          </div>
        )}
      </div>

      {/* Aviso previsão */}
      {isCurrentMonth && (
        <div className="flex items-start gap-2 mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>Os valores "a receber" são uma <strong>previsão</strong> baseada em agendamentos confirmados. Cancelamentos e faltas reduzem esse valor.</span>
        </div>
      )}

      {/* Por forma de pagamento */}
      <div className="card">
        <h2 className="font-medium text-gray-900 mb-4 text-sm">
          Recebido por forma de pagamento
          <span className="ml-2 text-xs font-normal text-gray-400 capitalize">— {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
        </h2>

        {loading ? (
          <div className="text-center py-8 text-gray-400 text-sm">Carregando...</div>
        ) : totalPorForma === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum pagamento registrado neste mês.</div>
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
                    <div className={`h-full rounded-full ${pm.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {naoInformado > 0 && (
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-sm">
                <span className="text-gray-400">Sem forma de pagamento informada</span>
                <span className="font-medium text-gray-500">R${naoInformado.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
