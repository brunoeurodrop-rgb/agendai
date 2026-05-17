'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Wallet, ReceiptText } from 'lucide-react'

export default function FinanceiroPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString()
    const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString()

    const [curr, last, byService] = await Promise.all([
      supabase.from('appointments').select('service:services(name,price)').gte('starts_at', monthStart).lte('starts_at', monthEnd).not('status', 'in', '(cancelled,no_show)'),
      supabase.from('appointments').select('service:services(price)').gte('starts_at', lastMonthStart).lte('starts_at', lastMonthEnd).not('status', 'in', '(cancelled,no_show)'),
      supabase.from('appointments').select('service:services(name,price)').gte('starts_at', monthStart).lte('starts_at', monthEnd).eq('status', 'completed'),
    ])

    const revenue = (curr.data || []).reduce((s: number, a: any) => s + (a.service?.price || 0), 0)
    const lastRevenue = (last.data || []).reduce((s: number, a: any) => s + (a.service?.price || 0), 0)
    const count = curr.data?.length || 0
    const ticketMedio = count > 0 ? revenue / count : 0

    // Receita por serviço
    const serviceMap: Record<string, { name: string; total: number; count: number }> = {}
    ;(byService.data || []).forEach((a: any) => {
      const name = a.service?.name || 'Desconhecido'
      const price = a.service?.price || 0
      if (!serviceMap[name]) serviceMap[name] = { name, total: 0, count: 0 }
      serviceMap[name].total += price
      serviceMap[name].count++
    })

    setData({ revenue, lastRevenue, count, ticketMedio, services: Object.values(serviceMap).sort((a, b) => b.total - a.total) })
    setLoading(false)
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>

  const growth = data.lastRevenue > 0 ? ((data.revenue - data.lastRevenue) / data.lastRevenue) * 100 : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Financeiro</h1>
        <p className="text-sm text-gray-500 mt-0.5">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Wallet, label: 'Receita do mês', value: `R$${data.revenue.toFixed(2)}`, sub: growth >= 0 ? `↑ ${growth.toFixed(0)}% vs mês anterior` : `↓ ${Math.abs(growth).toFixed(0)}% vs mês anterior`, green: growth >= 0 },
          { icon: ReceiptText, label: 'Total atendimentos', value: data.count, sub: 'No mês atual' },
          { icon: TrendingUp, label: 'Ticket médio', value: `R$${data.ticketMedio.toFixed(2)}`, sub: 'Por atendimento' },
          { icon: TrendingDown, label: 'Mês anterior', value: `R$${data.lastRevenue.toFixed(2)}`, sub: 'Para comparação' },
        ].map(({ icon: Icon, label, value, sub, green }) => (
          <div key={label} className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-brand-light p-1.5 rounded-lg"><Icon size={15} className="text-brand" /></div>
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {sub && <div className={`text-xs mt-1 ${green === false ? 'text-red-400' : green ? 'text-brand' : 'text-gray-400'}`}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Receita por serviço */}
      <div className="card">
        <h2 className="font-medium text-gray-900 mb-4 text-sm">Receita por serviço (mês atual — concluídos)</h2>
        {data.services.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum atendimento concluído este mês.</p>
        ) : (
          <div className="space-y-4">
            {data.services.map((s: any) => {
              const pct = data.services[0]?.total > 0 ? (s.total / data.services[0].total) * 100 : 0
              return (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">{s.name} <span className="text-gray-400 text-xs">({s.count}x)</span></span>
                    <strong className="text-gray-900">R${s.total.toFixed(2)}</strong>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
