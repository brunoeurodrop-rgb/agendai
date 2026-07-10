'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { MessageCircle, CheckCircle, XCircle, Clock, Send, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

const TZ = 'America/Sao_Paulo'

const MSG_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  confirmation: { label: 'Confirmação',   color: 'text-brand',    bg: 'bg-brand-light' },
  reminder_24h: { label: 'Lembrete 24h',  color: 'text-blue-600', bg: 'bg-blue-50' },
  reminder_1h:  { label: 'Lembrete 1h',   color: 'text-violet-600', bg: 'bg-violet-50' },
  cancellation: { label: 'Cancelamento',  color: 'text-red-500',  bg: 'bg-red-50' },
  rescheduling: { label: 'Reagendamento', color: 'text-amber-600', bg: 'bg-amber-50' },
}

function getMonthRange(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const start = new Date(`${y}-${m}-01T00:00:00-03:00`).toISOString()
  const lastDay = new Date(y, date.getMonth() + 1, 0).getDate()
  const end = new Date(`${y}-${m}-${String(lastDay).padStart(2,'0')}T23:59:59-03:00`).toISOString()
  return { start, end }
}

interface MsgLog {
  id: string
  type: string
  status: string
  phone: string
  sent_at: string | null
  created_at: string
  customer?: { name: string }
}

interface Stats {
  total: number
  enviadas: number
  falhas: number
  porTipo: Record<string, { enviadas: number; falhas: number }>
}

interface MonthBar {
  label: string
  enviadas: number
}

export default function WhatsAppPage() {
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ total: 0, enviadas: 0, falhas: 0, porTipo: {} })
  const [logs, setLogs] = useState<MsgLog[]>([])
  const [historico, setHistorico] = useState<MonthBar[]>([])
  const supabase = createClient()

  const isCurrentMonth = format(selectedMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM')

  useEffect(() => { loadAll() }, [selectedMonth])

  async function loadAll() {
    setLoading(true)
    await Promise.all([loadMonth(), loadHistorico()])
    setLoading(false)
  }

  async function loadMonth() {
    const { start, end } = getMonthRange(selectedMonth)

    const { data } = await supabase
      .from('messages_log')
      .select('*, customer:customers(name)')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      .limit(100)

    const msgs = (data || []) as MsgLog[]
    setLogs(msgs)

    const porTipo: Record<string, { enviadas: number; falhas: number }> = {}
    let enviadas = 0, falhas = 0

    msgs.forEach(m => {
      if (!porTipo[m.type]) porTipo[m.type] = { enviadas: 0, falhas: 0 }
      if (m.status === 'sent') { porTipo[m.type].enviadas++; enviadas++ }
      else { porTipo[m.type].falhas++; falhas++ }
    })

    setStats({ total: msgs.length, enviadas, falhas, porTipo })
  }

  async function loadHistorico() {
    const bars: MonthBar[] = []
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i)
      const { start, end } = getMonthRange(date)
      const label = format(date, 'MMM', { locale: ptBR })
      const { count } = await supabase
        .from('messages_log')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('created_at', start)
        .lte('created_at', end)
      bars.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        enviadas: count || 0,
      })
    }
    setHistorico(bars)
  }

  const taxaEntrega = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0
  const maxBar = Math.max(...historico.map(h => h.enviadas), 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estatísticas e histórico de mensagens automáticas</p>
      </div>

      {/* Gráfico histórico */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-gray-900 text-sm">Mensagens enviadas por mês</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
            <span className="text-sm font-medium text-gray-900 min-w-[130px] text-center capitalize">
              {format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <button onClick={() => setSelectedMonth(m => { const next = subMonths(m, -1); return isCurrentMonth ? m : next })}
              disabled={isCurrentMonth}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <div className="flex items-end gap-3 h-24 mb-2">
          {historico.map((h, i) => {
            const pct = Math.round((h.enviadas / maxBar) * 100)
            const isSel = h.label === format(selectedMonth, 'MMM', { locale: ptBR }).charAt(0).toUpperCase() + format(selectedMonth, 'MMM', { locale: ptBR }).slice(1)
            return (
              <button key={i} onClick={() => setSelectedMonth(subMonths(new Date(), 5 - i))}
                className="flex-1 flex flex-col items-center gap-1.5 group">
                <span className={`text-xs font-medium ${isSel ? 'text-brand' : 'text-gray-400'}`}>{h.enviadas}</span>
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${Math.max(pct, 4)}%`, background: isSel ? '#00C896' : '#E8F9F4', minHeight: '4px' }} />
                <span className={`text-xs ${isSel ? 'text-brand font-semibold' : 'text-gray-400'}`}>{h.label}</span>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">Clique em um mês para ver os detalhes abaixo</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-brand-light p-1.5 rounded-lg"><Send size={15} className="text-brand" /></div>
            <span className="text-xs text-gray-500">Total disparado</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-emerald-50 p-1.5 rounded-lg"><CheckCircle size={15} className="text-emerald-600" /></div>
            <span className="text-xs text-gray-500">Enviadas</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{stats.enviadas}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-50 p-1.5 rounded-lg"><XCircle size={15} className="text-red-500" /></div>
            <span className="text-xs text-gray-500">Falhas</span>
          </div>
          <div className="text-2xl font-bold text-red-500">{stats.falhas}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-50 p-1.5 rounded-lg"><MessageCircle size={15} className="text-blue-600" /></div>
            <span className="text-xs text-gray-500">Taxa de entrega</span>
          </div>
          <div className={`text-2xl font-bold ${taxaEntrega >= 90 ? 'text-emerald-600' : taxaEntrega >= 70 ? 'text-amber-500' : 'text-red-500'}`}>
            {taxaEntrega}%
          </div>
        </div>
      </div>

      {/* Aviso se houver falhas */}
      {stats.falhas > 0 && (
        <div className="flex items-start gap-2 mb-6 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>Existem <strong>{stats.falhas} mensagem{stats.falhas !== 1 ? 's' : ''}</strong> com falha neste mês. Verifique se o WhatsApp está conectado em <a href="/configuracoes" className="underline font-medium">Configurações</a>.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por tipo de mensagem */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">Por tipo de mensagem</h2>
          {Object.keys(stats.porTipo).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma mensagem enviada neste período.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(MSG_TYPES).map(([key, cfg]) => {
                const data = stats.porTipo[key]
                if (!data) return null
                const total = data.enviadas + data.falhas
                const pct = total > 0 ? Math.round((data.enviadas / total) * 100) : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="text-emerald-600 font-medium">{data.enviadas} ✓</span>
                        {data.falhas > 0 && <span className="text-red-500 font-medium">{data.falhas} ✗</span>}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Histórico recente */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">Mensagens recentes</h2>
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-6">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma mensagem neste período.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {logs.slice(0, 20).map(log => {
                const cfg = MSG_TYPES[log.type] || { label: log.type, color: 'text-gray-500', bg: 'bg-gray-100' }
                const date = new Date(log.created_at)
                return (
                  <div key={log.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.status === 'sent' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-500 truncate">{log.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <Clock size={11} />
                      {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })}
                      {' '}
                      {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
