'use client'
import { useEffect, useState, useMemo } from 'react'
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Shield, Users, Building2, X, Save, Loader2, CheckCircle,
  AlertCircle, Search, RefreshCw, TrendingUp, DollarSign,
  AlertTriangle, BarChart2, Percent
} from 'lucide-react'
import toast from 'react-hot-toast'

const PLANOS = ['trial', 'starter', 'pro', 'enterprise']
const PLANO_COLORS: Record<string, string> = {
  trial:      'bg-gray-700 text-gray-300',
  starter:    'bg-blue-900/60 text-blue-300',
  pro:        'bg-emerald-900/60 text-emerald-300',
  enterprise: 'bg-amber-900/60 text-amber-300',
}
const PLANO_PRECO: Record<string, number> = {
  starter: 49.90, pro: 99.90, enterprise: 249.90, trial: 0,
}

interface Org {
  id: string
  name: string
  plan: string
  trial_ends_at: string | null
  stripe_current_period_end: string | null
  created_at: string
  stripe_subscription_id: string | null
  wapi_instance_id: string | null
  limite_profissionais?: number | null
  limite_agendamentos?: number | null
  profiles?: { email: string; name: string }[]
  _stats?: { clientes: number; agendamentos: number; msgs: number }
}

function VencimentoBadge({ org }: { org: Org }) {
  if (org.plan === 'trial') {
    if (!org.trial_ends_at) return <span className="text-xs text-gray-500">—</span>
    const dias = differenceInDays(new Date(org.trial_ends_at), new Date())
    if (dias < 0) return <span className="text-xs font-medium text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">Trial expirado</span>
    if (dias <= 3) return <span className="text-xs font-medium text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Expira em {dias}d</span>
    return <span className="text-xs text-gray-400">Trial até {format(new Date(org.trial_ends_at), 'dd/MM', { locale: ptBR })}</span>
  }
  if (org.stripe_current_period_end) {
    const dias = differenceInDays(new Date(org.stripe_current_period_end), new Date())
    if (dias < 0) return <span className="text-xs font-medium text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">Plano expirado</span>
    if (dias <= 7) return <span className="text-xs font-medium text-amber-400 bg-amber-900/30 px-2 py-0.5 rounded-full">Renova em {dias}d</span>
    return <span className="text-xs text-gray-400">Renova em {format(new Date(org.stripe_current_period_end), 'dd/MM', { locale: ptBR })}</span>
  }
  return <span className="text-xs text-gray-500">—</span>
}

// Gráfico de barras SVG inline
function BarChart({ data, color = '#10b981' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 480, H = 120, barW = Math.floor((W - 40) / data.length) - 6, pad = 20

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ maxHeight: 160 }}>
      {data.map((d, i) => {
        const barH = Math.max(Math.round((d.value / max) * H), d.value > 0 ? 4 : 0)
        const x = pad + i * ((W - pad * 2) / data.length) + 3
        const y = H - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={color} opacity={0.85} />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={10} fill={color} fontWeight="600">{d.value}</text>
            )}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize={9} fill="#6b7280">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Gráfico de linha SVG inline
function LineChart({ data, color = '#10b981' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const W = 480, H = 100, pad = 24

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (W - pad * 2)
    const y = H - (d.value / max) * (H - 10) - 4
    return { x, y, ...d }
  })

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = pts.length > 0
    ? `${pathD} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`
    : ''

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} className="w-full" style={{ maxHeight: 150 }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {pts.length > 1 && (
        <>
          <path d={areaD} fill={`url(#grad-${color.replace('#','')})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill={color} />
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">
            {p.value > 0 ? `R$${p.value}` : ''}
          </text>
          <text x={p.x} y={H + 16} textAnchor="middle" fontSize={9} fill="#6b7280">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'expirando' | 'pagantes'>('todos')
  const [tab, setTab] = useState<'overview' | 'empresas' | 'financeiro'>('overview')
  const [editModal, setEditModal] = useState(false)
  const [editing, setEditing] = useState<Org | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    plan: 'trial',
    trial_ends_at: '',
    stripe_current_period_end: '',
    limite_profissionais: '',
    limite_agendamentos: '',
  })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/orgs')
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    setOrgs(data.orgs || [])
    setLoading(false)
  }

  function openEdit(org: Org) {
    setEditing(org)
    setForm({
      plan: org.plan,
      trial_ends_at: org.trial_ends_at ? org.trial_ends_at.split('T')[0] : '',
      stripe_current_period_end: org.stripe_current_period_end ? org.stripe_current_period_end.split('T')[0] : '',
      limite_profissionais: org.limite_profissionais != null ? String(org.limite_profissionais) : '',
      limite_agendamentos: org.limite_agendamentos != null ? String(org.limite_agendamentos) : '',
    })
    setEditModal(true)
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const payload: Record<string, unknown> = { plan: form.plan, org_id: editing.id }
    if (form.trial_ends_at) payload.trial_ends_at = new Date(form.trial_ends_at + 'T23:59:59-03:00').toISOString()
    if (form.stripe_current_period_end) payload.stripe_current_period_end = new Date(form.stripe_current_period_end + 'T23:59:59-03:00').toISOString()
    payload.limite_profissionais = form.limite_profissionais !== '' ? parseInt(form.limite_profissionais) : null
    payload.limite_agendamentos = form.limite_agendamentos !== '' ? parseInt(form.limite_agendamentos) : null
    const res = await fetch('/api/admin/orgs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); toast.error('Erro: ' + d.error); return }
    toast.success('Empresa atualizada!')
    setEditModal(false)
    load()
  }

  // ── Métricas ─────────────────────────────────────────────────────────────
  const pagantes = orgs.filter(o => ['starter', 'pro', 'enterprise'].includes(o.plan))
  const mrr = pagantes.reduce((s, o) => s + (PLANO_PRECO[o.plan] || 0), 0)
  const porPlano = orgs.reduce((acc, o) => { acc[o.plan] = (acc[o.plan] || 0) + 1; return acc }, {} as Record<string, number>)

  const expirando = orgs.filter(o => {
    const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
    if (!ref) return false
    const dias = differenceInDays(new Date(ref), new Date())
    return dias >= 0 && dias <= 7
  })
  const expirados = orgs.filter(o => {
    const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
    if (!ref) return false
    return differenceInDays(new Date(ref), new Date()) < 0 && o.plan === 'trial'
  })

  // Taxa de conversão: trials que viraram pagantes (têm plano pago e tiveram trial_ends_at)
  const convertidos = orgs.filter(o => ['starter', 'pro', 'enterprise'].includes(o.plan) && o.trial_ends_at).length
  const totalComTrial = orgs.filter(o => o.trial_ends_at).length
  const taxaConversao = totalComTrial > 0 ? Math.round((convertidos / totalComTrial) * 100) : 0

  // Série histórica dos últimos 6 meses
  const meses6 = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const dt = subMonths(new Date(), 5 - i)
    const label = format(dt, 'MMM', { locale: ptBR })
    const ini = startOfMonth(dt)
    const fim = endOfMonth(dt)
    const novas = orgs.filter(o => {
      const d = new Date(o.created_at)
      return d >= ini && d <= fim
    }).length
    const mrrMes = orgs.filter(o => {
      if (!['starter', 'pro', 'enterprise'].includes(o.plan)) return false
      const d = new Date(o.created_at)
      return d <= fim
    }).reduce((s, o) => s + (PLANO_PRECO[o.plan] || 0), 0)
    return { label, novas, mrr: mrrMes }
  }), [orgs])

  const filtered = orgs.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.profiles?.[0]?.email || '').toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filtro === 'pagantes') return ['starter', 'pro', 'enterprise'].includes(o.plan)
    if (filtro === 'expirando') {
      const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
      if (!ref) return false
      const dias = differenceInDays(new Date(ref), new Date())
      return dias >= 0 && dias <= 7
    }
    return true
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Shield size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Painel Admin</h1>
            <p className="text-sm text-gray-500">{orgs.length} empresas cadastradas</p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors px-3 py-2 rounded-lg hover:bg-gray-800 border border-gray-800">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-lg mb-8 w-fit border border-gray-800">
        {([
          ['overview', 'Visão geral', BarChart2],
          ['empresas', 'Empresas', Building2],
          ['financeiro', 'Financeiro', DollarSign],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === id
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Building2, color: 'text-gray-300', bg: 'bg-gray-800', label: 'Total empresas', value: orgs.length, sub: 'cadastradas' },
              { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-900/30', label: 'MRR estimado', value: `R$${mrr.toFixed(0)}`, sub: `${pagantes.length} assinantes` },
              { icon: Percent, color: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Taxa conversão', value: `${taxaConversao}%`, sub: `${convertidos} de ${totalComTrial} trials` },
              { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Expirando', value: expirando.length, sub: 'próximos 7 dias' },
            ].map((k, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`${k.bg} p-1.5 rounded-lg`}>
                    <k.icon size={14} className={k.color} />
                  </div>
                  <span className="text-xs text-gray-500">{k.label}</span>
                </div>
                <div className={`text-2xl font-bold ${k.color} mb-1`}>{k.value}</div>
                <div className="text-xs text-gray-600">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-200">Novas empresas / mês</h2>
                <span className="text-xs text-gray-600">últimos 6 meses</span>
              </div>
              <BarChart data={meses6.map(m => ({ label: m.label, value: m.novas }))} color="#10b981" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium text-gray-200">MRR acumulado / mês</h2>
                <span className="text-xs text-gray-600">últimos 6 meses</span>
              </div>
              <LineChart data={meses6.map(m => ({ label: m.label, value: m.mrr }))} color="#f59e0b" />
            </div>
          </div>

          {/* Distribuição por plano */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-medium text-gray-200 mb-4">Distribuição por plano</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PLANOS.map(p => {
                const qtd = porPlano[p] || 0
                const pct = orgs.length > 0 ? Math.round((qtd / orgs.length) * 100) : 0
                return (
                  <div key={p} className="bg-gray-800/60 rounded-lg p-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLANO_COLORS[p]}`}>{p}</span>
                    <div className="text-xl font-bold text-white mt-2 mb-1">{qtd}</div>
                    <div className="h-1 bg-gray-700 rounded-full mt-2">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{pct}% do total</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Alertas rápidos */}
          {(expirando.length > 0 || expirados.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {expirando.length > 0 && (
                <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-5">
                  <h2 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
                    <AlertTriangle size={14} /> Expirando nos próximos 7 dias
                  </h2>
                  <div className="space-y-2">
                    {expirando.slice(0, 5).map(o => {
                      const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
                      const dias = ref ? differenceInDays(new Date(ref), new Date()) : 0
                      return (
                        <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                          <div>
                            <div className="text-sm font-medium text-gray-200">{o.name}</div>
                            <div className="text-xs text-gray-500">{o.profiles?.[0]?.email || '—'}</div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLANO_COLORS[o.plan]}`}>{o.plan}</span>
                            <div className="text-xs text-amber-400 mt-1">{dias === 0 ? 'hoje!' : `${dias}d`}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {expirados.length > 0 && (
                <div className="bg-gray-900 border border-emerald-900/40 rounded-xl p-5">
                  <h2 className="text-sm font-medium text-emerald-400 mb-4 flex items-center gap-2">
                    <TrendingUp size={14} /> Trials expirados — potencial de conversão
                  </h2>
                  <div className="space-y-2">
                    {expirados.slice(0, 5).map(o => (
                      <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-gray-200">{o.name}</div>
                          <div className="text-xs text-gray-500">{o.profiles?.[0]?.email || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {o.trial_ends_at ? format(new Date(o.trial_ends_at), 'dd/MM', { locale: ptBR }) : '—'}
                          </div>
                          <div className="text-xs text-gray-600">{o._stats?.agendamentos} agend.</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA FINANCEIRO ── */}
      {tab === 'financeiro' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-900/30', label: 'MRR estimado', value: `R$${mrr.toFixed(2)}`, sub: `${pagantes.length} assinante${pagantes.length !== 1 ? 's' : ''}` },
              { icon: CheckCircle, color: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Planos pagos', value: pagantes.length, sub: `de ${orgs.length} total` },
              { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Expirando (7d)', value: expirando.length, sub: 'atenção necessária' },
              { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-900/30', label: 'Trial expirado', value: expirados.length, sub: 'potencial de conversão' },
            ].map((k, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`${k.bg} p-1.5 rounded-lg`}><k.icon size={14} className={k.color} /></div>
                  <span className="text-xs text-gray-500">{k.label}</span>
                </div>
                <div className={`text-2xl font-bold ${k.color} mb-1`}>{k.value}</div>
                <div className="text-xs text-gray-600">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-200 mb-4">Receita por plano</h2>
              <div className="space-y-4">
                {['pro', 'starter', 'enterprise'].map(p => {
                  const qtd = porPlano[p] || 0
                  const receita = qtd * PLANO_PRECO[p]
                  const pct = mrr > 0 ? Math.round((receita / mrr) * 100) : 0
                  return (
                    <div key={p}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLANO_COLORS[p]}`}>{p}</span>
                          <span className="text-xs text-gray-500">{qtd} empresa{qtd !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-200">R${receita.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-gray-900 border border-amber-900/40 rounded-xl p-5">
              <h2 className="text-sm font-medium text-amber-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={14} /> Expirando nos próximos 7 dias
              </h2>
              {expirando.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Nenhuma empresa expirando em breve.</p>
              ) : (
                <div className="space-y-3">
                  {expirando.map(o => {
                    const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
                    const dias = ref ? differenceInDays(new Date(ref), new Date()) : 0
                    return (
                      <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-gray-200">{o.name}</div>
                          <div className="text-xs text-gray-500">{o.profiles?.[0]?.email || '—'}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLANO_COLORS[o.plan]}`}>{o.plan}</span>
                          <div className="text-xs text-amber-400 mt-1 font-medium">
                            {dias === 0 ? 'Expira hoje!' : `${dias} dia${dias !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {expirados.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-400" /> Trials expirados — potencial de conversão
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Empresa</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">E-mail</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Expirou</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Clientes</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Agend.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expirados.map(o => (
                      <tr key={o.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3 font-medium text-gray-200">{o.name}</td>
                        <td className="px-5 py-3 text-gray-500">{o.profiles?.[0]?.email || '—'}</td>
                        <td className="px-5 py-3 text-right text-red-400 text-xs">
                          {o.trial_ends_at ? format(new Date(o.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-400">{o._stats?.clientes}</td>
                        <td className="px-5 py-3 text-right text-gray-400">{o._stats?.agendamentos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA EMPRESAS ── */}
      {tab === 'empresas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Building2, color: 'text-gray-300', bg: 'bg-gray-800', label: 'Total', value: orgs.length },
              { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-900/30', label: 'Pagantes', value: pagantes.length },
              { icon: Users, color: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Em trial', value: porPlano.trial || 0 },
              { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Expirando', value: expirando.length },
            ].map((k, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`${k.bg} p-1.5 rounded-lg`}><k.icon size={14} className={k.color} /></div>
                  <span className="text-xs text-gray-500">{k.label}</span>
                </div>
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-3 flex-wrap">
              <h2 className="text-sm font-medium text-gray-200 flex-1">Empresas cadastradas</h2>
              <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
                {([['todos', 'Todas'], ['pagantes', 'Pagantes'], ['expirando', 'Expirando']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFiltro(id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtro === id ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg pl-8 pr-3 py-1.5 w-48 placeholder-gray-600 focus:outline-none focus:border-gray-500"
                  placeholder="Buscar..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500 text-sm gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800">
                      {['Empresa', 'Plano', 'Vencimento', 'Cadastro', 'Clientes', 'Agend.', 'Msgs', 'WhatsApp', 'Extras', 'Ações'].map(h => (
                        <th key={h} className={`px-5 py-3 text-xs text-gray-500 font-medium ${['Clientes','Agend.','Msgs'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(org => (
                      <tr key={org.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-200">{org.name}</div>
                          <div className="text-xs text-gray-500">{org.profiles?.[0]?.email || '—'}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${PLANO_COLORS[org.plan]}`}>{org.plan}</span>
                        </td>
                        <td className="px-5 py-3.5"><VencimentoBadge org={org} /></td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 font-medium">{org._stats?.clientes}</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 font-medium">{org._stats?.agendamentos}</td>
                        <td className="px-5 py-3.5 text-right text-gray-400 font-medium">{org._stats?.msgs}</td>
                        <td className="px-5 py-3.5">
                          {org.wapi_instance_id
                            ? <span className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Sim</span>
                            : <span className="text-xs text-gray-600">Não</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">
                          {org.limite_profissionais != null && <div>+{org.limite_profissionais} prof.</div>}
                          {org.limite_agendamentos != null && <div>+{org.limite_agendamentos} agend.</div>}
                          {org.limite_profissionais == null && org.limite_agendamentos == null && <span className="text-gray-700">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => openEdit(org)} className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium transition-colors">Editar</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10} className="text-center py-12 text-gray-600 text-sm">Nenhuma empresa encontrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal edição */}
      {editModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-100">{editing.name}</h2>
                <p className="text-xs text-gray-500">{editing.profiles?.[0]?.email}</p>
              </div>
              <button onClick={() => setEditModal(false)} className="text-gray-500 hover:text-gray-300 transition-colors"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-400 block mb-2">Plano</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLANOS.map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                      className={`py-2 rounded-xl text-sm font-medium border capitalize transition-all ${
                        form.plan === p
                          ? 'border-emerald-600 bg-emerald-900/40 text-emerald-300'
                          : 'border-gray-700 text-gray-500 hover:border-gray-500'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {form.plan === 'trial' && (
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Trial válido até</label>
                  <input type="date" value={form.trial_ends_at} onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500" />
                </div>
              )}
              {['starter', 'pro', 'enterprise'].includes(form.plan) && (
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Vencimento do plano</label>
                  <input type="date" value={form.stripe_current_period_end} onChange={e => setForm(f => ({ ...f, stripe_current_period_end: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500" />
                </div>
              )}
              <div className="p-4 bg-amber-950/30 border border-amber-900/40 rounded-xl">
                <h3 className="text-xs font-medium text-amber-400 mb-3">Recursos adicionais</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Profissionais extras</label>
                    <input type="number" min="0" placeholder="Ex: 2" value={form.limite_profissionais} onChange={e => setForm(f => ({ ...f, limite_profissionais: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">Agendamentos extras/mês</label>
                    <input type="number" min="0" step="200" placeholder="Ex: 200" value={form.limite_agendamentos} onChange={e => setForm(f => ({ ...f, limite_agendamentos: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-gray-500" />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-800/50 rounded-xl text-xs text-gray-500 space-y-1.5">
                <div className="flex justify-between"><span>Cadastrado:</span><strong className="text-gray-400">{format(new Date(editing.created_at), 'dd/MM/yyyy', { locale: ptBR })}</strong></div>
                <div className="flex justify-between"><span>Clientes:</span><strong className="text-gray-400">{editing._stats?.clientes}</strong></div>
                <div className="flex justify-between"><span>Agendamentos:</span><strong className="text-gray-400">{editing._stats?.agendamentos}</strong></div>
                <div className="flex justify-between"><span>Msgs WhatsApp:</span><strong className="text-gray-400">{editing._stats?.msgs}</strong></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="flex-1 px-4 py-2 rounded-xl text-sm font-medium border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center justify-center gap-2" onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
