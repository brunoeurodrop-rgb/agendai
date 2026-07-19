'use client'
import { useEffect, useState } from 'react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Shield, Users, Building2, X, Save, Loader2, CheckCircle, AlertCircle, Search, RefreshCw, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'
const PLANOS = ['trial', 'starter', 'pro', 'enterprise']
const PLANO_COLORS: Record<string, string> = {
  trial:      'bg-gray-100 text-gray-600',
  starter:    'bg-blue-50 text-blue-700',
  pro:        'bg-brand-light text-brand-dark',
  enterprise: 'bg-amber-50 text-amber-700',
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
    if (!org.trial_ends_at) return <span className="text-xs text-gray-400">—</span>
    const dias = differenceInDays(new Date(org.trial_ends_at), new Date())
    if (dias < 0) return <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Trial expirado</span>
    if (dias <= 3) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Expira em {dias}d</span>
    return <span className="text-xs text-gray-500">Trial até {format(new Date(org.trial_ends_at), 'dd/MM', { locale: ptBR })}</span>
  }
  if (org.stripe_current_period_end) {
    const dias = differenceInDays(new Date(org.stripe_current_period_end), new Date())
    if (dias < 0) return <span className="text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Plano expirado</span>
    if (dias <= 7) return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Renova em {dias}d</span>
    return <span className="text-xs text-gray-500">Renova em {format(new Date(org.stripe_current_period_end), 'dd/MM', { locale: ptBR })}</span>
  }
  return <span className="text-xs text-gray-400">—</span>
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'expirando' | 'pagantes'>('todos')
  const [tab, setTab] = useState<'empresas' | 'financeiro'>('empresas')
  const [editModal, setEditModal] = useState(false)
  const [editing, setEditing] = useState<Org | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ plan: 'trial', trial_ends_at: '', limite_profissionais: '', limite_agendamentos: '' })
  const router = useRouter()

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const res = await fetch('/api/admin/check')
    if (!res.ok) { toast.error('Acesso restrito.'); router.push('/dashboard'); return }
    load()
  }

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
      limite_profissionais: org.limite_profissionais != null ? String(org.limite_profissionais) : '',
      limite_agendamentos: org.limite_agendamentos != null ? String(org.limite_agendamentos) : '',
    })
    setEditModal(true)
  }

  async function saveEdit() {
    if (!editing) return
    setSaving(true)
    const payload: any = { plan: form.plan, org_id: editing.id }
    if (form.trial_ends_at) payload.trial_ends_at = new Date(form.trial_ends_at + 'T23:59:59-03:00').toISOString()
    payload.limite_profissionais = form.limite_profissionais !== '' ? parseInt(form.limite_profissionais) : null
    payload.limite_agendamentos = form.limite_agendamentos !== '' ? parseInt(form.limite_agendamentos) : null
    const res = await fetch('/api/admin/orgs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); toast.error('Erro: ' + d.error); return }
    toast.success('Empresa atualizada!')
    setEditModal(false)
    load()
  }

  // Métricas financeiras
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

  const filtered = orgs.filter(o => {
    const matchSearch = o.name.toLowerCase().includes(search.toLowerCase()) || (o.profiles?.[0]?.email || '').toLowerCase().includes(search.toLowerCase())
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Shield size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel Administrador</h1>
          <p className="text-sm text-gray-500">Gerencie todas as empresas do AgendaAI</p>
        </div>
        <button onClick={load} className="ml-auto btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {([['empresas', 'Empresas'], ['financeiro', 'Financeiro']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ABA FINANCEIRO */}
      {tab === 'financeiro' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><div className="bg-brand-light p-1.5 rounded-lg"><DollarSign size={15} className="text-brand" /></div><span className="text-xs text-gray-500">MRR estimado</span></div>
              <div className="text-2xl font-bold text-brand">R${mrr.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-1">{pagantes.length} assinante{pagantes.length !== 1 ? 's' : ''} ativos</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><div className="bg-emerald-50 p-1.5 rounded-lg"><CheckCircle size={15} className="text-emerald-600" /></div><span className="text-xs text-gray-500">Planos pagos</span></div>
              <div className="text-2xl font-bold text-emerald-600">{pagantes.length}</div>
              <div className="text-xs text-gray-400 mt-1">de {orgs.length} total</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><div className="bg-amber-50 p-1.5 rounded-lg"><AlertTriangle size={15} className="text-amber-600" /></div><span className="text-xs text-gray-500">Expirando (7 dias)</span></div>
              <div className="text-2xl font-bold text-amber-600">{expirando.length}</div>
              <div className="text-xs text-gray-400 mt-1">atenção necessária</div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2 mb-3"><div className="bg-red-50 p-1.5 rounded-lg"><AlertCircle size={15} className="text-red-500" /></div><span className="text-xs text-gray-500">Trial expirado</span></div>
              <div className="text-2xl font-bold text-red-500">{expirados.length}</div>
              <div className="text-xs text-gray-400 mt-1">potencial de conversão</div>
            </div>
          </div>

          {/* Receita por plano */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h2 className="font-medium text-gray-900 mb-4 text-sm">Receita por plano</h2>
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
                          <span className="text-xs text-gray-400">{qtd} empresa{qtd !== 1 ? 's' : ''}</span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">R${receita.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Empresas expirando */}
            <div className="card">
              <h2 className="font-medium text-gray-900 mb-4 text-sm flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" /> Expirando nos próximos 7 dias
              </h2>
              {expirando.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhuma empresa expirando em breve.</p>
              ) : (
                <div className="space-y-3">
                  {expirando.map(o => {
                    const ref = o.plan === 'trial' ? o.trial_ends_at : o.stripe_current_period_end
                    const dias = ref ? differenceInDays(new Date(ref), new Date()) : 0
                    const email = o.profiles?.[0]?.email || '—'
                    return (
                      <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{o.name}</div>
                          <div className="text-xs text-gray-400">{email}</div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${PLANO_COLORS[o.plan]}`}>{o.plan}</span>
                          <div className="text-xs text-amber-600 mt-1 font-medium">
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

          {/* Trials expirados — potencial de conversão */}
          {expirados.length > 0 && (
            <div className="card">
              <h2 className="font-medium text-gray-900 mb-4 text-sm flex items-center gap-2">
                <TrendingUp size={15} className="text-brand" /> Trials expirados — potencial de conversão
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">Empresa</th>
                      <th className="text-left px-4 py-2.5 text-xs text-gray-500 font-medium">E-mail</th>
                      <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Expirou em</th>
                      <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Clientes</th>
                      <th className="text-right px-4 py-2.5 text-xs text-gray-500 font-medium">Agend.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expirados.map(o => (
                      <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{o.name}</td>
                        <td className="px-4 py-3 text-gray-500">{o.profiles?.[0]?.email || '—'}</td>
                        <td className="px-4 py-3 text-right text-red-500 text-xs">{o.trial_ends_at ? format(new Date(o.trial_ends_at), 'dd/MM/yyyy', { locale: ptBR }) : '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{o._stats?.clientes}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{o._stats?.agendamentos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA EMPRESAS */}
      {tab === 'empresas' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card"><div className="flex items-center gap-2 mb-2"><Building2 size={15} className="text-gray-400" /><span className="text-xs text-gray-500">Total</span></div><div className="text-2xl font-bold text-gray-900">{orgs.length}</div></div>
            <div className="card"><div className="flex items-center gap-2 mb-2"><CheckCircle size={15} className="text-brand" /><span className="text-xs text-gray-500">Pagantes</span></div><div className="text-2xl font-bold text-brand">{pagantes.length}</div></div>
            <div className="card"><div className="flex items-center gap-2 mb-2"><AlertCircle size={15} className="text-gray-400" /><span className="text-xs text-gray-500">Em trial</span></div><div className="text-2xl font-bold text-gray-500">{porPlano.trial || 0}</div></div>
            <div className="card"><div className="flex items-center gap-2 mb-2"><AlertTriangle size={15} className="text-amber-500" /><span className="text-xs text-gray-500">Expirando</span></div><div className="text-2xl font-bold text-amber-500">{expirando.length}</div></div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
              <h2 className="font-medium text-gray-900 text-sm flex-1">Empresas cadastradas</h2>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {([['todos', 'Todas'], ['pagantes', 'Pagantes'], ['expirando', 'Expirando']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFiltro(id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${filtro === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 py-2 text-sm w-52" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Empresa</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Plano</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Vencimento</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Cadastro</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Clientes</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Agend.</th>
                      <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Msgs</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">WhatsApp</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Extras</th>
                      <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(org => (
                      <tr key={org.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-gray-900">{org.name}</div>
                          <div className="text-xs text-gray-400">{org.profiles?.[0]?.email || '—'}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${PLANO_COLORS[org.plan]}`}>{org.plan}</span>
                        </td>
                        <td className="px-5 py-3.5"><VencimentoBadge org={org} /></td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}</td>
                        <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.clientes}</td>
                        <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.agendamentos}</td>
                        <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.msgs}</td>
                        <td className="px-5 py-3.5">
                          {org.wapi_instance_id
                            ? <span className="text-xs text-emerald-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Sim</span>
                            : <span className="text-xs text-gray-400">Não</span>}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">
                          {org.limite_profissionais != null && <div>+{org.limite_profissionais} prof.</div>}
                          {org.limite_agendamentos != null && <div>+{org.limite_agendamentos} agend.</div>}
                          {org.limite_profissionais == null && org.limite_agendamentos == null && <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => openEdit(org)} className="text-xs text-brand hover:underline font-medium">Editar</button>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">Nenhuma empresa encontrada.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal edição */}
      {editModal && editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">{editing.name}</h2>
                <p className="text-xs text-gray-400">{editing.profiles?.[0]?.email}</p>
              </div>
              <button onClick={() => setEditModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Plano</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLANOS.map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                      className={`py-2 rounded-xl text-sm font-medium border capitalize transition-all ${form.plan === p ? 'border-brand bg-brand-light text-brand-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              {form.plan === 'trial' && (
                <div>
                  <label className="label">Trial válido até</label>
                  <input type="date" className="input" value={form.trial_ends_at} onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
                </div>
              )}
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <h3 className="text-sm font-medium text-amber-800 mb-3">Recursos adicionais pagos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Profissionais extras</label>
                    <input type="number" min="0" className="input" placeholder="Ex: 2" value={form.limite_profissionais} onChange={e => setForm(f => ({ ...f, limite_profissionais: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Soma ao limite do plano</p>
                  </div>
                  <div>
                    <label className="label">Agendamentos extras/mês</label>
                    <input type="number" min="0" step="200" className="input" placeholder="Ex: 200" value={form.limite_agendamentos} onChange={e => setForm(f => ({ ...f, limite_agendamentos: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Soma ao limite do plano</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1.5">
                <div className="flex justify-between"><span>Cadastrado em:</span><strong>{format(new Date(editing.created_at), 'dd/MM/yyyy', { locale: ptBR })}</strong></div>
                <div className="flex justify-between"><span>Clientes:</span><strong>{editing._stats?.clientes}</strong></div>
                <div className="flex justify-between"><span>Agendamentos:</span><strong>{editing._stats?.agendamentos}</strong></div>
                <div className="flex justify-between"><span>Msgs WhatsApp:</span><strong>{editing._stats?.msgs}</strong></div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setEditModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={saveEdit} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
