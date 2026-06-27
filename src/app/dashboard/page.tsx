'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck, Users, Wallet, X, MessageCircle, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Appointment } from '@/types'

const TZ = 'America/Sao_Paulo'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const dateLocal = date.toLocaleDateString('pt-BR', { timeZone: TZ })
  const todayLocal = today.toLocaleDateString('pt-BR', { timeZone: TZ })
  const tomorrowLocal = tomorrow.toLocaleDateString('pt-BR', { timeZone: TZ })
  if (dateLocal === todayLocal) return 'Hoje'
  if (dateLocal === tomorrowLocal) return 'Amanhã'
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
}

// Calcula o início e fim do dia de HOJE em horário de Brasília, retornando os
// timestamps UTC corretos para usar nas queries (já que o banco salva tudo em UTC).
function getTodayRangeBrasiliaAsUTC() {
  const now = new Date()
  // Pega a data de hoje no fuso de Brasília como string "YYYY-MM-DD"
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ }) // formato YYYY-MM-DD
  // Meia-noite em Brasília = 03:00 UTC do mesmo dia (Brasília é UTC-3)
  const start = new Date(`${todayStr}T00:00:00-03:00`)
  const end = new Date(`${todayStr}T23:59:59.999-03:00`)
  return { start, end }
}

interface Metrics {
  todayTotal: number
  whatsappEnviadosHoje: number
  ativosConfirmados: number
  cancelamentos: number
  todayRevenue: number
  monthRevenue: number
  newCustomersThisMonth: number
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => { loadData() }, [pathname])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadData()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  async function loadData() {
    const { start: todayStart, end: todayEnd } = getTodayRangeBrasiliaAsUTC()
    const todayStartISO = todayStart.toISOString()
    const todayEndISO = todayEnd.toISOString()

    // Início do mês em Brasília (dia 1, 00:00) convertido para UTC
    const now = new Date()
    const monthStr = now.toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7) // YYYY-MM
    const monthStart = new Date(`${monthStr}-01T00:00:00-03:00`).toISOString()
    const next7days = addDays(todayEnd, 7).toISOString()

    const [todayRes, upcomingRes, cancelRes, monthRes, customersRes, msgsHojeRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, customer:customers(*), professional:professionals(*), service:services(*)')
        .gte('starts_at', todayStartISO)
        .lte('starts_at', todayEndISO)
        .not('status', 'eq', 'cancelled')
        .order('starts_at'),
      supabase
        .from('appointments')
        .select('*, customer:customers(*), professional:professionals(*), service:services(*)')
        .gt('starts_at', todayEndISO)
        .lte('starts_at', next7days)
        .not('status', 'eq', 'cancelled')
        .order('starts_at')
        .limit(10),
      supabase
        .from('appointments')
        .select('id')
        .gte('starts_at', todayStartISO)
        .lte('starts_at', todayEndISO)
        .eq('status', 'cancelled'),
      supabase
        .from('appointments')
        .select('service:services(price)')
        .gte('starts_at', monthStart)
        .eq('status', 'completed'),
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart),
      // Mensagens enviadas HOJE (pela data de envio, em horário de Brasília)
      supabase
        .from('messages_log')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', todayStartISO)
        .lte('sent_at', todayEndISO),
    ])

    const appts = todayRes.data || []
    const cancelados = cancelRes.data || []
    const month = monthRes.data || []

    setTodayAppts(appts)
    setUpcomingAppts(upcomingRes.data || [])
    setMetrics({
      todayTotal: appts.length + cancelados.length,
      whatsappEnviadosHoje: msgsHojeRes.count || 0,
      ativosConfirmados: appts.filter(a => a.status === 'confirmed').length,
      cancelamentos: cancelados.length,
      todayRevenue: appts.filter(a => a.status === 'completed').reduce((s, a) => s + ((a.service as any)?.price || 0), 0),
      monthRevenue: month.reduce((s: number, a: any) => s + (a.service?.price || 0), 0),
      newCustomersThisMonth: customersRes.count || 0,
    })
    setLoading(false)
  }

  const statusConfig: Record<string, { label: string; cls: string }> = {
    confirmed: { label: 'Confirmado', cls: 'pill-green' },
    pending:   { label: 'Pendente',   cls: 'pill-yellow' },
    cancelled: { label: 'Cancelado',  cls: 'pill-red' },
    completed: { label: 'Concluído',  cls: 'pill-blue' },
    no_show:   { label: 'Faltou',     cls: 'pill-gray' },
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  const allAppts = [...todayAppts, ...upcomingAppts]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: CalendarCheck, label: 'Agendamentos hoje', value: metrics!.todayTotal, color: 'text-brand', bg: 'bg-brand-light' },
          { icon: Users, label: 'Novos clientes', value: metrics!.newCustomersThisMonth, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: Wallet, label: 'Faturamento hoje', value: `R$${metrics!.todayRevenue.toFixed(2)}`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: X, label: 'Cancelamentos hoje', value: metrics!.cancelamentos, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className={`${bg} p-1.5 rounded-lg`}><Icon size={15} className={color} /></div>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-brand" />
              <h2 className="font-medium text-gray-900 text-sm">Próximos agendamentos</h2>
            </div>
            <Link href="/agenda" className="text-xs text-brand hover:underline flex items-center gap-1">
              Ver agenda <ChevronRight size={12} />
            </Link>
          </div>
          {allAppts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Nenhum agendamento nos próximos 7 dias.</p>
              <Link href="/agendamento" className="btn-primary inline-block mt-3 text-xs px-4 py-2">+ Novo agendamento</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {allAppts.slice(0, 8).map(a => {
                const s = statusConfig[a.status] || statusConfig.pending
                const dateLabel = formatDateShort(a.starts_at)
                const isToday = dateLabel === 'Hoje'
                return (
                  <div key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark text-xs font-semibold flex items-center justify-center shrink-0">
                      {(a.customer as any)?.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{(a.customer as any)?.name}</div>
                      <div className="text-xs text-gray-400">
                        <span className={isToday ? 'text-brand font-medium' : 'text-gray-500'}>{dateLabel}</span>
                        {' · '}{formatTime(a.starts_at)} · {(a.service as any)?.name}
                      </div>
                    </div>
                    <span className={s.cls + ' shrink-0'}>{s.label}</span>
                  </div>
                )
              })}
              {allAppts.length > 8 && (
                <div className="pt-3 text-center">
                  <Link href="/agenda" className="text-xs text-brand hover:underline">
                    Ver todos os {allAppts.length} agendamentos
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={16} className="text-brand" />
            <h2 className="font-medium text-gray-900 text-sm">Status do dia</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'WhatsApp enviados hoje', value: metrics!.whatsappEnviadosHoje, max: Math.max(metrics!.whatsappEnviadosHoje, 1), color: 'bg-brand' },
              { label: 'Ativos (confirmados)', value: metrics!.ativosConfirmados, max: metrics!.todayTotal || 1, color: 'bg-blue-400' },
              { label: 'Cancelamentos hoje', value: metrics!.cancelamentos, max: metrics!.todayTotal || 1, color: 'bg-red-400' },
            ].map(({ label, value, max, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">{label}</span>
                  <strong className="text-gray-900">{value}</strong>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.round((value / max) * 100)}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-2 p-3 bg-brand-light rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-dark font-medium">Faturamento do mês</span>
                <strong className="text-brand-dark">R${metrics!.monthRevenue.toFixed(2)}</strong>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Próximos 7 dias</span>
                <strong className="text-gray-900">{upcomingAppts.length} agendamento{upcomingAppts.length !== 1 ? 's' : ''}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
