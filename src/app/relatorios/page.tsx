'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, Users, Calendar, X, Award, Info } from 'lucide-react'

const TZ = 'America/Sao_Paulo'

function getMonthRangeBrasiliaAsUTC(monthOffset = 0) {
  const now = new Date()
  const monthStr = now.toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7)
  const [year, month] = monthStr.split('-').map(Number)
  const targetMonth = month + monthOffset
  const start = new Date(year, targetMonth - 1, 1)
  const end = new Date(year, targetMonth, 0, 23, 59, 59)
  // Ajusta para considerar timezone -03:00
  const startISO = new Date(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01T00:00:00-03:00`).toISOString()
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const endISO = new Date(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59-03:00`).toISOString()
  return { start: startISO, end: endISO, label: start }
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true)
  const [recebidoMes, setRecebidoMes] = useState(0)
  const [agendadoMes, setAgendadoMes] = useState(0)
  const [qtdConcluidos, setQtdConcluidos] = useState(0)
  const [qtdCancelados, setQtdCancelados] = useState(0)
  const [qtdTotal, setQtdTotal] = useState(0)
  const [novoClientes, setNovoClientes] = useState(0)
  const [topServicos, setTopServicos] = useState<{ nome: string; qtd: number; valor: number }[]>([])
  const [topProfissionais, setTopProfissionais] = useState<{ nome: string; qtd: number }[]>([])
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { start, end } = getMonthRangeBrasiliaAsUTC()

    const { data: appts } = await supabase
      .from('appointments')
      .select('status, service:services(name, price), professional:professionals(name)')
      .gte('starts_at', start)
      .lte('starts_at', end)

    const all = appts || []
    const completed = all.filter(a => a.status === 'completed')
    const cancelled = all.filter(a => a.status === 'cancelled')
    const notCancelled = all.filter(a => a.status !== 'cancelled')

    setQtdTotal(all.length)
    setQtdConcluidos(completed.length)
    setQtdCancelados(cancelled.length)
    setRecebidoMes(completed.reduce((s, a: any) => s + (a.service?.price || 0), 0))
    setAgendadoMes(notCancelled.reduce((s, a: any) => s + (a.service?.price || 0), 0))

    const { count } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)

    setNovoClientes(count || 0)

    // Top serviços (todos exceto cancelados)
    const svcMap: Record<string, { qtd: number; valor: number }> = {}
    notCancelled.forEach((a: any) => {
      const nome = a.service?.name || 'Desconhecido'
      if (!svcMap[nome]) svcMap[nome] = { qtd: 0, valor: 0 }
      svcMap[nome].qtd++
      svcMap[nome].valor += a.service?.price || 0
    })
    setTopServicos(Object.entries(svcMap).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.qtd - a.qtd).slice(0, 5))

    // Top profissionais
    const profMap: Record<string, number> = {}
    notCancelled.forEach((a: any) => {
      const nome = a.professional?.name || 'Desconhecido'
      profMap[nome] = (profMap[nome] || 0) + 1
    })
    setTopProfissionais(Object.entries(profMap).map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 5))

    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      {/* Aviso de conceito — evita a confusão entre Relatório x Financeiro */}
      <div className="flex items-start gap-2 mb-6 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Valor agendado</strong> soma todos os atendimentos do mês (já realizados + ainda confirmados), exceto cancelados.
          <strong> Valor recebido</strong> soma apenas o que já foi efetivamente concluído e pago. Para o detalhamento por forma de pagamento e previsão de caixa, acesse a tela <strong>Financeiro</strong>.
        </span>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-brand-light p-1.5 rounded-lg"><TrendingUp size={15} className="text-brand" /></div>
            <span className="text-xs text-gray-500">Valor agendado no mês</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">R${agendadoMes.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">Realizados + confirmados futuros</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-50 p-1.5 rounded-lg"><Award size={15} className="text-emerald-600" /></div>
            <span className="text-xs text-gray-500">Valor já recebido</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">R${recebidoMes.toFixed(2)}</div>
          <div className="text-xs text-gray-400 mt-1">{qtdConcluidos} concluído{qtdConcluidos !== 1 ? 's' : ''}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-50 p-1.5 rounded-lg"><Calendar size={15} className="text-blue-600" /></div>
            <span className="text-xs text-gray-500">Total de agendamentos</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{qtdTotal}</div>
          <div className="text-xs text-gray-400 mt-1">No mês atual</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-50 p-1.5 rounded-lg"><X size={15} className="text-red-500" /></div>
            <span className="text-xs text-gray-500">Cancelamentos</span>
          </div>
          <div className="text-2xl font-bold text-red-500">{qtdCancelados}</div>
          <div className="text-xs text-gray-400 mt-1">No mês atual</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top serviços */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">Serviços mais agendados</h2>
          {topServicos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum dado disponível ainda.</p>
          ) : (
            <div className="space-y-3">
              {topServicos.map((s, i) => (
                <div key={s.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <span className="text-sm text-gray-700">{s.nome}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-900">{s.qtd}x</span>
                    <span className="text-xs text-gray-400 ml-2">R${s.valor.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top profissionais */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">Profissionais com mais atendimentos</h2>
          {topProfissionais.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum dado disponível ainda.</p>
          ) : (
            <div className="space-y-3">
              {topProfissionais.map((p, i) => (
                <div key={p.nome} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">{i + 1}</span>
                    <span className="text-sm text-gray-700">{p.nome}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{p.qtd} atendimento{p.qtd !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card mt-6 flex items-center gap-3">
        <Users size={18} className="text-brand" />
        <div>
          <div className="text-sm text-gray-500">Novos clientes este mês</div>
          <div className="text-xl font-bold text-gray-900">{novoClientes}</div>
        </div>
      </div>
    </div>
  )
}
