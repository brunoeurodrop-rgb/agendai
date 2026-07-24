'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, addDays, subDays, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck, Users, Wallet, MessageCircle, Clock, ChevronRight, TrendingUp, TrendingDown, Target, Zap, Award, Star, AlertCircle, BarChart2, Shield } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Appointment } from '@/types'

const TZ = 'America/Sao_Paulo'

function getTodayRangeBrasiliaAsUTC() {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: TZ })
  return {
    start: new Date(`${todayStr}T00:00:00-03:00`),
    end: new Date(`${todayStr}T23:59:59.999-03:00`),
  }
}

function getMonthRangeUTC(date: Date) {
  const y = date.getFullYear()
  const m = date.getMonth()
  return {
    start: new Date(Date.UTC(y, m, 1, 0, 0, 0)).toISOString(),
    end: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)).toISOString(),
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr)
  const today = new Date()
  const tomorrow = addDays(today, 1)
  const dl = date.toLocaleDateString('pt-BR', { timeZone: TZ })
  const tl = today.toLocaleDateString('pt-BR', { timeZone: TZ })
  const tmt = tomorrow.toLocaleDateString('pt-BR', { timeZone: TZ })
  if (dl === tl) return 'Hoje'
  if (dl === tmt) return 'Amanhã'
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ })
}

function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null
  const up = pct >= 0
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
      <Icon size={11} /> {up ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

function MetaBar({ atual, meta, label }: { atual: number; meta: number; label: string }) {
  const pct = Math.min(Math.round((atual / meta) * 100), 100)
  const atingiu = pct >= 100
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{label}</span>
        <div className="flex items-center gap-2">
          {atingiu && <span className="text-xs">🎉</span>}
          <span className={`text-xs font-bold ${atingiu ? 'text-brand' : 'text-gray-700'}`}>{pct}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${atingiu ? 'bg-brand' : pct >= 70 ? 'bg-amber-400' : 'bg-gray-300'}`}
          style={{ width: `${pct}%` }} />
      </div>
      {atingiu && <p className="text-xs text-brand font-medium mt-1.5">Meta alcançada! 🎉</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([])
  const [todayAppts, setTodayAppts] = useState<Appointment[]>([])
  const [graficoTipo, setGraficoTipo] = useState<'faturamento' | 'agendamentos'>('faturamento')
  const [grafico30, setGrafico30] = useState<{ dia: string; valor: number; agendamentos: number }[]>([])

  // Métricas hoje
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [prevDayRevenue, setPrevDayRevenue] = useState(0)
  const [todayTotal, setTodayTotal] = useState(0)
  const [prevDayTotal, setPrevDayTotal] = useState(0)
  const [todayConcluidos, setTodayConcluidos] = useState(0)
  const [todayConfirmados, setTodayConfirmados] = useState(0)

  // Métricas mês
  const [monthRevenue, setMonthRevenue] = useState(0)
  const [prevMonthRevenue, setPrevMonthRevenue] = useState(0)
  const [monthAppts, setMonthAppts] = useState(0)
  const [prevMonthAppts, setPrevMonthAppts] = useState(0)
  const [monthNewClients, setMonthNewClients] = useState(0)
  const [ticketMedio, setTicketMedio] = useState(0)

  // WhatsApp
  const [waStats, setWaStats] = useState({ total: 0, enviadas: 0, falhas: 0, confirmacoes: 0 })

  // Desempenho
  const [topService, setTopService] = useState<{ name: string; count: number } | null>(null)
  const [topProfessional, setTopProfessional] = useState<{ name: string; revenue: number } | null>(null)
  const [topClient, setTopClient] = useState<{ name: string; count: number } | null>(null)
  const [inativeClients, setInactiveClients] = useState(0)

  // Meta
  const [metaReceita, setMetaReceita] = useState<{ value: number; isSuggestion: boolean } | null>(null)

  // Insights
  const [insights, setInsights] = useState<string[]>([])

  const supabase = createClient()
  const pathname = usePathname()

  useEffect(() => { loadAll() }, [pathname])
  useEffect(() => {
    const fn = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', fn)
    return () => document.removeEventListener('visibilitychange', fn)
  }, [])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) { setLoading(false); return }
    const orgId = profile.org_id

    const { start: todayStart, end: todayEnd } = getTodayRangeBrasiliaAsUTC()
    const { start: monthStart, end: monthEnd } = getMonthRangeUTC(new Date())
    const { start: prevMonthStart, end: prevMonthEnd } = getMonthRangeUTC(subMonths(new Date(), 1))
    const prevDayStart = new Date(subDays(todayStart, 1)).toISOString()
    const prevDayEnd = new Date(subDays(todayEnd, 1)).toISOString()
    const currentMonth = format(new Date(), 'yyyy-MM')

    const [
      todayRes, prevDayRes, upcomingRes,
      monthRes, prevMonthRes,
      newClientsRes, prevMonthClientsRes,
      topServiceRes, topProfRes, topClientRes,
      waRes, inactiveRes,
      metaRes,
    ] = await Promise.all([
      // Hoje
      supabase.from('appointments').select('*, service:services(name,price), customer:customers(name), professional:professionals(name)').gte('starts_at', todayStart.toISOString()).lte('starts_at', todayEnd.toISOString()).order('starts_at'),
      // Dia anterior
      supabase.from('appointments').select('status, service:services(price)').gte('starts_at', prevDayStart).lte('starts_at', prevDayEnd),
      // Próximos 7 dias
      supabase.from('appointments').select('*, service:services(name,price), customer:customers(name), professional:professionals(name)').gt('starts_at', todayEnd.toISOString()).lte('starts_at', addDays(todayEnd, 7).toISOString()).not('status', 'eq', 'cancelled').order('starts_at').limit(8),
      // Mês atual
      supabase.from('appointments').select('status, service:services(name,price), professional:professionals(name)').gte('starts_at', monthStart).lte('starts_at', monthEnd),
      // Mês anterior
      supabase.from('appointments').select('status, service:services(price)').gte('starts_at', prevMonthStart).lte('starts_at', prevMonthEnd).eq('status', 'completed'),
      // Novos clientes mês
      supabase.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', monthStart).lte('created_at', monthEnd),
      // Novos clientes mês anterior
      supabase.from('customers').select('*', { count: 'exact', head: true }).gte('created_at', prevMonthStart).lte('created_at', prevMonthEnd),
      // Top serviço
      supabase.from('appointments').select('service:services(name)').gte('starts_at', monthStart).lte('starts_at', monthEnd).not('status', 'eq', 'cancelled'),
      // Top profissional
      supabase.from('appointments').select('professional:professionals(name), service:services(price)').gte('starts_at', monthStart).lte('starts_at', monthEnd).eq('status', 'completed'),
      // Top cliente
      supabase.from('appointments').select('customer_id, customer:customers(name)').gte('starts_at', monthStart).lte('starts_at', monthEnd).not('status', 'eq', 'cancelled'),
      // WhatsApp mês
      supabase.from('messages_log').select('type, status').gte('created_at', monthStart).lte('created_at', monthEnd),
      // Clientes inativos (sem agendamento nos últimos 60 dias)
      supabase.from('customers').select('id').eq('org_id', orgId),
      // Meta
      supabase.from('goals').select('*').eq('org_id', orgId).eq('month', currentMonth).eq('type', 'revenue').maybeSingle(),
    ])

    // Hoje
    const today = todayRes.data || []
    const concluidos = today.filter(a => a.status === 'completed')
    const confirmados = today.filter(a => a.status === 'confirmed')
    const todayRev = concluidos.reduce((s, a: any) => s + (a.service?.price || 0), 0)
    setTodayAppts(today)
    setTodayRevenue(todayRev)
    setTodayTotal(today.filter(a => a.status !== 'cancelled').length)
    setTodayConcluidos(concluidos.length)
    setTodayConfirmados(confirmados.length)

    // Dia anterior
    const pd = prevDayRes.data || []
    const pdConcluidos = pd.filter((a: any) => a.status === 'completed')
    setPrevDayRevenue(pdConcluidos.reduce((s, a: any) => s + (a.service?.price || 0), 0))
    setPrevDayTotal(pd.filter((a: any) => a.status !== 'cancelled').length)

    // Upcoming
    setUpcomingAppts(upcomingRes.data || [])

    // Mês
    const month = monthRes.data || []
    const monthCompleted = month.filter((a: any) => a.status === 'completed')
    const mRev = monthCompleted.reduce((s, a: any) => s + (a.service?.price || 0), 0)
    setMonthRevenue(mRev)
    setMonthAppts(month.filter((a: any) => a.status !== 'cancelled').length)
    setMonthNewClients(newClientsRes.count || 0)
    setTicketMedio(monthCompleted.length > 0 ? mRev / monthCompleted.length : 0)

    // Mês anterior
    const pmRev = (prevMonthRes.data || []).reduce((s, a: any) => s + (a.service?.price || 0), 0)
    setPrevMonthRevenue(pmRev)
    setPrevMonthAppts((prevMonthRes.data || []).length)

    // Top serviço
    const svcCount: Record<string, number> = {}
    ;(topServiceRes.data || []).forEach((a: any) => {
      const n = a.service?.name; if (n) svcCount[n] = (svcCount[n] || 0) + 1
    })
    const topSvc = Object.entries(svcCount).sort((a, b) => b[1] - a[1])[0]
    setTopService(topSvc ? { name: topSvc[0], count: topSvc[1] } : null)

    // Top profissional
    const profRev: Record<string, number> = {}
    ;(topProfRes.data || []).forEach((a: any) => {
      const n = a.professional?.name; if (n) profRev[n] = (profRev[n] || 0) + (a.service?.price || 0)
    })
    const topProf = Object.entries(profRev).sort((a, b) => b[1] - a[1])[0]
    setTopProfessional(topProf ? { name: topProf[0], revenue: topProf[1] } : null)

    // Top cliente
    const clientCount: Record<string, { name: string; count: number }> = {}
    ;(topClientRes.data || []).forEach((a: any) => {
      const id = a.customer_id; const name = (a.customer as any)?.name
      if (id && name) { if (!clientCount[id]) clientCount[id] = { name, count: 0 }; clientCount[id].count++ }
    })
    const topCl = Object.values(clientCount).sort((a, b) => b.count - a.count)[0]
    setTopClient(topCl || null)

    // WhatsApp
    const wa = waRes.data || []
    const waEnviadas = wa.filter((m: any) => m.status === 'sent').length
    const waFalhas = wa.filter((m: any) => m.status === 'failed').length
    const waConf = wa.filter((m: any) => m.type === 'confirmation' && m.status === 'sent').length
    setWaStats({ total: wa.length, enviadas: waEnviadas, falhas: waFalhas, confirmacoes: waConf })

    // Meta
    if (metaRes.data) {
      setMetaReceita({ value: metaRes.data.target_value, isSuggestion: metaRes.data.is_suggestion })
    } else if (pmRev > 0) {
      setMetaReceita({ value: Math.ceil(pmRev * 1.1), isSuggestion: true })
    } else {
      setMetaReceita(null)
    }

    // Gráfico 30 dias — busca separada para cobrir mês anterior também
    const g30start = new Date(Date.UTC(
      new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 29
    )).toISOString()
    const g30end = new Date(Date.UTC(
      new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 23, 59, 59
    )).toISOString()

    const { data: g30data } = await supabase
      .from('appointments')
      .select('starts_at, status, service:services(price)')
      .gte('starts_at', g30start)
      .lte('starts_at', g30end)
      .not('status', 'eq', 'cancelled')

    const g30: { dia: string; valor: number; agendamentos: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = subDays(new Date(), i)
      const dStr = d.toLocaleDateString('en-CA', { timeZone: TZ })
      const dStart = new Date(`${dStr}T00:00:00-03:00`).toISOString()
      const dEnd = new Date(`${dStr}T23:59:59.999-03:00`).toISOString()
      const dayData = (g30data || []).filter((a: any) => a.starts_at >= dStart && a.starts_at <= dEnd)
      g30.push({
        dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        valor: dayData.filter((a: any) => a.status === 'completed').reduce((s: number, a: any) => s + ((a.service as any)?.price || 0), 0),
        agendamentos: dayData.length,
      })
    }
    setGrafico30(g30)

    // Insights automáticos
    const ins: string[] = []
    if (prevMonthRevenue > 0 && mRev > 0) {
      const pctRev = ((mRev - pmRev) / pmRev) * 100
      if (pctRev > 0) ins.push(`Seu faturamento cresceu ${pctRev.toFixed(1)}% em relação ao mês anterior.`)
      else ins.push(`Seu faturamento caiu ${Math.abs(pctRev).toFixed(1)}% em relação ao mês anterior.`)
    }
    if (topSvc) ins.push(`"${topSvc[0]}" é o serviço mais agendado este mês (${topSvc[1]} atendimentos).`)
    if (waConf > 0 && ticketMedio > 0) {
      const receitaProtegida = waConf * (mRev / (monthCompleted.length || 1))
      ins.push(`Você preservou aproximadamente R$${receitaProtegida.toFixed(2)} com confirmações automáticas.`)
    }
    if (newClientsRes.count && newClientsRes.count > 0) ins.push(`${newClientsRes.count} novo${newClientsRes.count !== 1 ? 's cliente chegaram' : ' cliente chegou'} este mês.`)
    setInsights(ins)

    setLoading(false)
  }

  const deltaRevToday = prevDayRevenue > 0 ? ((todayRevenue - prevDayRevenue) / prevDayRevenue) * 100 : null
  const deltaRevMonth = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : null
  const taxaComparecimento = (todayConcluidos + todayConfirmados) > 0 ? Math.round((todayConcluidos / (todayConcluidos + todayConfirmados)) * 100) : null
  const receitaProtegida = waStats.confirmacoes > 0 && ticketMedio > 0 ? waStats.confirmacoes * ticketMedio : 0
  const maxGrafico = Math.max(...grafico30.map(d => d.valor), 1)

  const statusConfig: Record<string, { label: string; cls: string }> = {
    confirmed: { label: 'Confirmado', cls: 'pill-green' },
    pending:   { label: 'Pendente',   cls: 'pill-yellow' },
    cancelled: { label: 'Cancelado',  cls: 'pill-red' },
    completed: { label: 'Concluído',  cls: 'pill-blue' },
    no_show:   { label: 'Faltou',     cls: 'pill-gray' },
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  const allAppts = [...todayAppts.filter(a => a.status !== 'cancelled'), ...upcomingAppts]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
        <Link href="/agendamento" className="btn-primary flex items-center gap-2 text-sm">
          <CalendarCheck size={15} /> Novo agendamento
        </Link>
      </div>

      {/* Cards hoje */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Hoje</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-brand-light p-1.5 rounded-lg"><CalendarCheck size={15} className="text-brand" /></div><span className="text-xs text-gray-500">Agendamentos</span></div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{todayTotal}</div>
            {prevDayTotal > 0 && <DeltaBadge pct={prevDayTotal > 0 ? ((todayTotal - prevDayTotal) / prevDayTotal) * 100 : null} />}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-emerald-50 p-1.5 rounded-lg"><Users size={15} className="text-emerald-600" /></div><span className="text-xs text-gray-500">Atendidos</span></div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{todayConcluidos}</div>
            {taxaComparecimento !== null && <span className="text-xs text-gray-400">Taxa: <strong className="text-gray-700">{taxaComparecimento}%</strong></span>}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-amber-50 p-1.5 rounded-lg"><Wallet size={15} className="text-amber-600" /></div><span className="text-xs text-gray-500">Faturamento</span></div>
            <div className="text-2xl font-bold text-gray-900 mb-1">R${todayRevenue.toFixed(2)}</div>
            <DeltaBadge pct={deltaRevToday} />
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-blue-50 p-1.5 rounded-lg"><Clock size={15} className="text-blue-600" /></div><span className="text-xs text-gray-500">Próximos</span></div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{upcomingAppts.length}</div>
            <span className="text-xs text-gray-400">nos próximos 7 dias</span>
          </div>
        </div>
      </div>

      {/* Resumo do mês */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Resumo do mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-brand-light p-1.5 rounded-lg"><TrendingUp size={15} className="text-brand" /></div><span className="text-xs text-gray-500">Faturamento</span></div>
            <div className="text-2xl font-bold text-brand mb-1">R${monthRevenue.toFixed(2)}</div>
            <DeltaBadge pct={deltaRevMonth} />
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-violet-50 p-1.5 rounded-lg"><CalendarCheck size={15} className="text-violet-600" /></div><span className="text-xs text-gray-500">Atendimentos</span></div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{monthAppts}</div>
            {prevMonthAppts > 0 && <DeltaBadge pct={((monthAppts - prevMonthAppts) / prevMonthAppts) * 100} />}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-teal-50 p-1.5 rounded-lg"><Wallet size={15} className="text-teal-600" /></div><span className="text-xs text-gray-500">Ticket médio</span></div>
            <div className="text-2xl font-bold text-gray-900">R${ticketMedio.toFixed(2)}</div>
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><div className="bg-blue-50 p-1.5 rounded-lg"><Users size={15} className="text-blue-600" /></div><span className="text-xs text-gray-500">Novos clientes</span></div>
            <div className="text-2xl font-bold text-gray-900">{monthNewClients}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximos agendamentos */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Clock size={16} className="text-brand" /><h2 className="font-medium text-gray-900 text-sm">Próximos agendamentos</h2></div>
            <Link href="/agenda" className="text-xs text-brand hover:underline flex items-center gap-1">Ver agenda <ChevronRight size={12} /></Link>
          </div>
          {allAppts.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">📅</div>
              <p className="text-sm text-gray-400 mb-4">Nenhum agendamento por aqui ainda.</p>
              <Link href="/agendamento" className="btn-primary text-sm px-5 py-2.5">+ Novo agendamento</Link>
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
                        {' · '}{formatTime(a.starts_at)} · {(a.service as any)?.name} · {(a.professional as any)?.name}
                      </div>
                    </div>
                    <span className={s.cls + ' shrink-0'}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Meta + WhatsApp */}
        <div className="space-y-4">
          {/* Meta */}
          {metaReceita && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><Target size={15} className="text-brand" /><h2 className="font-medium text-gray-900 text-sm">Meta do mês</h2>
                <Link href="/configuracoes/metas" className="ml-auto text-xs text-gray-400 hover:text-brand">Editar</Link>
              </div>
              {metaReceita.isSuggestion && (
                <p className="text-xs text-gray-400 mb-3 flex items-center gap-1"><AlertCircle size={11} /> Meta sugerida — <Link href="/configuracoes/metas" className="underline">personalizar</Link></p>
              )}
              <MetaBar atual={monthRevenue} meta={metaReceita.value} label={`R$${monthRevenue.toFixed(2)} de R$${metaReceita.value.toFixed(2)}`} />
            </div>
          )}

          {/* WhatsApp */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><MessageCircle size={15} className="text-brand" /><h2 className="font-medium text-gray-900 text-sm">WhatsApp este mês</h2></div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-gray-900">{waStats.enviadas}</div><div className="text-xs text-gray-400 mt-0.5">Enviadas</div></div>
              <div className="bg-gray-50 rounded-xl p-3 text-center"><div className="text-lg font-bold text-red-500">{waStats.falhas}</div><div className="text-xs text-gray-400 mt-0.5">Falhas</div></div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
              <div className="h-full bg-brand rounded-full" style={{ width: `${waStats.total > 0 ? Math.round((waStats.enviadas / waStats.total) * 100) : 0}%` }} />
            </div>
            <div className="text-xs text-gray-400 text-right mb-3">{waStats.total > 0 ? Math.round((waStats.enviadas / waStats.total) * 100) : 0}% taxa de entrega</div>
            {receitaProtegida > 0 && (
              <div className="bg-brand-light border border-brand/20 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1"><Zap size={13} className="text-brand" /><span className="text-xs font-semibold text-brand-dark">Receita protegida</span></div>
                <div className="text-xl font-bold text-brand">R${receitaProtegida.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">Estimativa baseada nas confirmações automáticas</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico 30 dias */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><BarChart2 size={15} className="text-brand" /><h2 className="font-medium text-gray-900 text-sm">Evolução dos últimos 30 dias</h2></div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['faturamento', 'agendamentos'] as const).map(t => (
              <button key={t} onClick={() => setGraficoTipo(t)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${graficoTipo === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end gap-1 h-32">
          {grafico30.map((d, i) => {
            const val = graficoTipo === 'faturamento' ? d.valor : (d.agendamentos || 0)
            const maxVal = graficoTipo === 'faturamento' ? maxGrafico : Math.max(...grafico30.map(g => g.agendamentos || 0), 1)
            const pct = Math.max(Math.round((val / maxVal) * 100), val > 0 ? 5 : 0)
            const isToday = i === 29
            return (
              <div key={i} className="flex-1 flex flex-col items-center group relative">
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  {d.dia}{graficoTipo === 'faturamento' ? ` · R$${d.valor.toFixed(0)}` : ` · ${d.agendamentos || 0} agend.`}
                </div>
                <div className="w-full rounded-t-sm transition-all"
                  style={{ height: `${Math.max(pct, val > 0 ? 8 : 0)}%`, background: isToday ? '#00C896' : '#C8F0E4', minHeight: val > 0 ? '8px' : '0' }} />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-400">{grafico30[0]?.dia}</span>
          <span className="text-xs text-gray-400">Hoje</span>
        </div>
      </div>

      {/* Desempenho */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Desempenho do mês</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><Star size={15} className="text-amber-500" /><h3 className="text-sm font-medium text-gray-700">Serviço mais vendido</h3></div>
            {topService ? (
              <>
                <div className="text-base font-bold text-gray-900">{topService.name}</div>
                <div className="text-xs text-gray-400 mt-1">{topService.count} atendimento{topService.count !== 1 ? 's' : ''} este mês</div>
              </>
            ) : <p className="text-sm text-gray-400">Sem dados ainda</p>}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><Award size={15} className="text-violet-500" /><h3 className="text-sm font-medium text-gray-700">Profissional destaque</h3></div>
            {topProfessional ? (
              <>
                <div className="text-base font-bold text-gray-900">{topProfessional.name}</div>
                <div className="text-xs text-gray-400 mt-1">R${topProfessional.revenue.toFixed(2)} faturados este mês</div>
              </>
            ) : <p className="text-sm text-gray-400">Sem dados ainda</p>}
          </div>
          <div className="card">
            <div className="flex items-center gap-2 mb-3"><Users size={15} className="text-blue-500" /><h3 className="text-sm font-medium text-gray-700">Cliente mais recorrente</h3></div>
            {topClient ? (
              <>
                <div className="text-base font-bold text-gray-900">{topClient.name}</div>
                <div className="text-xs text-gray-400 mt-1">{topClient.count} agendamento{topClient.count !== 1 ? 's' : ''} este mês</div>
              </>
            ) : <p className="text-sm text-gray-400">Sem dados ainda</p>}
          </div>
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4"><Zap size={15} className="text-amber-500" /><h2 className="font-medium text-gray-900 text-sm">Insights do seu negócio</h2></div>
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 shrink-0" />
                <p className="text-sm text-gray-700">{ins}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
