'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarCheck, Users, Wallet, X, TrendingUp, MessageCircle, Clock } from 'lucide-react'
import type { Appointment } from '@/types'

interface Metrics {
  todayTotal: number
  confirmed: number
  pending: number
  cancelled: number
  todayRevenue: number
  monthRevenue: number
  newCustomers: number
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const today = new Date()
    const todayStart = startOfDay(today).toISOString()
    const todayEnd = endOfDay(today).toISOString()
    const monthStart = startOfMonth(today).toISOString()

    const { data: todayAppts } = await supabase
      .from('appointments')
      .select('*, customer:customers(*), professional:professionals(*), service:services(*)')
      .gte('starts_at', todayStart)
      .lte('starts_at', todayEnd)
      .order('starts_at')

    const { data: monthAppts } = await supabase
      .from('appointments')
      .select('status, service:services(price)')
      .gte('starts_at', monthStart)
      .neq('status', 'cancelled')

    const { count: newCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart)

    const appts = todayAppts || []
    const month = monthAppts || []

    setAppointments(appts)
    setMetrics({
      todayTotal: appts.length,
      confirmed: appts.filter(a => a.status === 'confirmed').length,
      pending: appts.filter(a => a.status === 'pending').length,
      cancelled: appts.filter(a => a.status === 'cancelled').length,
      todayRevenue: appts.filter(a => a.status !== 'cancelled').reduce((s, a) => s + (a.service?.price || 0), 0),
      monthRevenue: month.reduce((s: number, a: any) => s + (a.service?.price || 0), 0),
      newCustomers: newCustomers || 0,
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

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: CalendarCheck, label: 'Agendamentos hoje', value: metrics!.todayTotal, color: 'text-brand', bg: 'bg-brand-light' },
          { icon: Users,         label: 'Novos clientes',    value: metrics!.newCustomers, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: Wallet,        label: 'Faturamento hoje',  value: `R$${metrics!.todayRevenue.toFixed(2)}`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: X,             label: 'Cancelamentos',     value: metrics!.cancelled, color: 'text-red-500', bg: 'bg-red-50' },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className={`${bg} p-1.5 rounded-lg`}>
                <Icon size={15} className={color} />
              </div>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Próximos agendamentos */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-brand" />
            <h2 className="font-medium text-gray-900 text-sm">Agendamentos de hoje</h2>
          </div>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum agendamento para hoje.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {appointments.map(a => {
                const s = statusConfig[a.status] || statusConfig.pending
                return (
                  <div key={a.id} className="flex items-center gap-3 py-3">
                    <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark text-xs font-semibold flex items-center justify-center shrink-0">
                      {a.customer?.name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{a.customer?.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })} · {a.service?.name} · {a.professional?.name}
                      </div>
                    </div>
                    <span className={s.cls}>{s.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Resumo WhatsApp */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={16} className="text-brand" />
            <h2 className="font-medium text-gray-900 text-sm">Status das automações</h2>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Confirmações enviadas', value: metrics!.confirmed, max: metrics!.todayTotal || 1 },
              { label: 'Pendentes de resposta', value: metrics!.pending, max: metrics!.todayTotal || 1 },
              { label: 'Cancelamentos', value: metrics!.cancelled, max: metrics!.todayTotal || 1 },
            ].map(({ label, value, max }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">{label}</span>
                  <strong className="text-gray-900">{value}</strong>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all"
                    style={{ width: `${Math.round((value / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-4 p-3 bg-brand-light rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-dark font-medium">Faturamento do mês</span>
                <strong className="text-brand-dark">R${metrics!.monthRevenue.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
