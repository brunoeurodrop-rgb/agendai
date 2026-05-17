'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TrendingUp, Users, CalendarCheck, XCircle } from 'lucide-react'

export default function RelatoriosPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const meses = [0,1,2,3,4].map(i => {
      const d = subMonths(now, i)
      return { label: format(d, 'MMM', { locale: ptBR }), start: startOfMonth(d).toISOString(), end: endOfMonth(d).toISOString() }
    }).reverse()

    const results = await Promise.all(meses.map(m =>
      supabase.from('appointments').select('status, service:services(price)').gte('starts_at', m.start).lte('starts_at', m.end)
    ))

    const porMes = results.map((r, i) => {
      const appts = r.data || []
      return {
        label: meses[i].label,
        total: appts.length,
        confirmados: appts.filter((a:any) => a.status === 'confirmed' || a.status === 'completed').length,
        cancelados: appts.filter((a:any) => a.status === 'cancelled').length,
        receita: appts.filter((a:any) => a.status !== 'cancelled').reduce((s: number, a: any) => s + (a.service?.price || 0), 0),
      }
    })

    const atual = porMes[porMes.length - 1]
    const { count: totalClientes } = await supabase.from('customers').select('*', { count: 'exact', head: true })
    setData({ porMes, atual, totalClientes })
    setLoading(false)
  }

  if (loading) return <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>

  const maxReceita = Math.max(...data.porMes.map((m: any) => m.receita), 1)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Últimos 5 meses</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { icon: CalendarCheck, label: 'Agendamentos', value: data.atual.total, color: 'text-brand', bg: 'bg-brand-light' },
          { icon: TrendingUp, label: 'Receita do mês', value: `R$${data.atual.receita.toFixed(2)}`, color: 'text-amber-600', bg: 'bg-amber-50' },
          { icon: Users, label: 'Total clientes', value: data.totalClientes || 0, color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: XCircle, label: 'Cancelamentos', value: data.atual.cancelados, color: 'text-red-500', bg: 'bg-red-50' },
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

      <div className="card mb-6">
        <h2 className="font-medium text-gray-900 text-sm mb-5">Receita por mês</h2>
        <div className="flex items-end gap-4 h-40">
          {data.porMes.map((m: any, i: number) => {
            const pct = Math.round((m.receita / maxReceita) * 100)
            const isLast = i === data.porMes.length - 1
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="text-xs text-gray-400">R${m.receita.toFixed(0)}</div>
                <div className="w-full flex items-end" style={{ height: '90px' }}>
                  <div className="w-full rounded-t-lg" style={{ height: `${Math.max(pct, 4)}%`, background: isLast ? '#00C896' : '#d1fae5' }} />
                </div>
                <div className={`text-xs font-medium capitalize ${isLast ? 'text-brand' : 'text-gray-400'}`}>{m.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2 className="font-medium text-gray-900 text-sm mb-4">Detalhamento mensal</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs text-gray-500 font-medium">Mês</th>
              <th className="text-right py-2 text-xs text-gray-500 font-medium">Total</th>
              <th className="text-right py-2 text-xs text-gray-500 font-medium">Confirmados</th>
              <th className="text-right py-2 text-xs text-gray-500 font-medium">Cancelados</th>
              <th className="text-right py-2 text-xs text-gray-500 font-medium">Receita</th>
            </tr>
          </thead>
          <tbody>
            {data.porMes.map((m: any, i: number) => (
              <tr key={m.label} className={`border-b border-gray-50 ${i === data.porMes.length - 1 ? 'font-medium' : ''}`}>
                <td className="py-3 capitalize text-gray-900">{m.label}</td>
                <td className="py-3 text-right text-gray-600">{m.total}</td>
                <td className="py-3 text-right text-brand">{m.confirmados}</td>
                <td className="py-3 text-right text-red-400">{m.cancelados}</td>
                <td className="py-3 text-right text-gray-900">R${m.receita.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
