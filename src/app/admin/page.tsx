'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Shield, Users, Building2, X, Save, Loader2, CheckCircle, AlertCircle, Search, RefreshCw } from 'lucide-react'
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

interface Org {
  id: string
  name: string
  plan: string
  trial_ends_at: string | null
  created_at: string
  stripe_subscription_id: string | null
  wapi_instance_id: string | null
  limite_profissionais?: number | null
  limite_agendamentos?: number | null
  profiles?: { email: string; name: string }[]
  _stats?: { clientes: number; agendamentos: number; msgs: number }
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState(false)
  const [editing, setEditing] = useState<Org | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    plan: 'trial',
    trial_ends_at: '',
    limite_profissionais: '',
    limite_agendamentos: '',
  })
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => { checkAdmin() }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      toast.error('Acesso restrito ao administrador.')
      router.push('/dashboard')
      return
    }
    load()
  }

  async function load() {
    setLoading(true)
    const { data: orgsData } = await supabase
      .from('organizations')
      .select('*, profiles(email, name)')
      .order('created_at', { ascending: false })

    if (!orgsData) { setLoading(false); return }

    // Buscar stats de cada org
    const orgsWithStats = await Promise.all(orgsData.map(async org => {
      const [c, a, m] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
        supabase.from('messages_log').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      ])
      return { ...org, _stats: { clientes: c.count || 0, agendamentos: a.count || 0, msgs: m.count || 0 } }
    }))

    setOrgs(orgsWithStats)
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
    const payload: any = { plan: form.plan }
    if (form.trial_ends_at) payload.trial_ends_at = new Date(form.trial_ends_at + 'T23:59:59-03:00').toISOString()
    if (form.limite_profissionais !== '') payload.limite_profissionais = parseInt(form.limite_profissionais)
    else payload.limite_profissionais = null
    if (form.limite_agendamentos !== '') payload.limite_agendamentos = parseInt(form.limite_agendamentos)
    else payload.limite_agendamentos = null

    const { error } = await supabase.from('organizations').update(payload).eq('id', editing.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar: ' + error.message); return }
    toast.success('Empresa atualizada!')
    setEditModal(false)
    load()
  }

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.profiles?.[0]?.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalOrgs = orgs.length
  const porPlano = orgs.reduce((acc, o) => { acc[o.plan] = (acc[o.plan] || 0) + 1; return acc }, {} as Record<string, number>)
  const totalMsgs = orgs.reduce((s, o) => s + (o._stats?.msgs || 0), 0)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
          <Shield size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel Administrador</h1>
          <p className="text-sm text-gray-500">Gerencie todas as empresas cadastradas no AgendaAI</p>
        </div>
        <button onClick={load} className="ml-auto btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Métricas gerais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><Building2 size={15} className="text-gray-400" /><span className="text-xs text-gray-500">Total de empresas</span></div>
          <div className="text-2xl font-bold text-gray-900">{totalOrgs}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><CheckCircle size={15} className="text-brand" /><span className="text-xs text-gray-500">Planos pagos</span></div>
          <div className="text-2xl font-bold text-brand">{(porPlano.starter || 0) + (porPlano.pro || 0) + (porPlano.enterprise || 0)}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><AlertCircle size={15} className="text-gray-400" /><span className="text-xs text-gray-500">Em trial</span></div>
          <div className="text-2xl font-bold text-gray-500">{porPlano.trial || 0}</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-2"><Users size={15} className="text-violet-500" /><span className="text-xs text-gray-500">Msgs WhatsApp</span></div>
          <div className="text-2xl font-bold text-violet-600">{totalMsgs}</div>
        </div>
      </div>

      {/* Distribuição por plano */}
      <div className="card mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Distribuição por plano</h2>
        <div className="flex gap-3 flex-wrap">
          {PLANOS.map(p => (
            <div key={p} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${PLANO_COLORS[p]}`}>
              <span className="capitalize">{p}</span>
              <span className="font-bold">{porPlano[p] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de empresas */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <h2 className="font-medium text-gray-900 text-sm flex-1">Empresas cadastradas</h2>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 py-2 text-sm w-56" placeholder="Buscar empresa ou e-mail..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando empresas...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Empresa</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Plano</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Cadastro</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Clientes</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Agend.</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Msgs WA</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">WhatsApp</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Limites extras</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(org => {
                  const email = org.profiles?.[0]?.email || '—'
                  return (
                    <tr key={org.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-gray-900">{org.name}</div>
                        <div className="text-xs text-gray-400">{email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${PLANO_COLORS[org.plan]}`}>
                          {org.plan}
                        </span>
                        {org.trial_ends_at && org.plan === 'trial' && (
                          <div className="text-xs text-gray-400 mt-1">
                            até {format(new Date(org.trial_ends_at), 'dd/MM', { locale: ptBR })}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {format(new Date(org.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.clientes}</td>
                      <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.agendamentos}</td>
                      <td className="px-5 py-3.5 text-right text-gray-700 font-medium">{org._stats?.msgs}</td>
                      <td className="px-5 py-3.5">
                        {org.wapi_instance_id ? (
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Configurado
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Não configurado</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {org.limite_profissionais != null && <div>+{org.limite_profissionais} prof.</div>}
                        {org.limite_agendamentos != null && <div>+{org.limite_agendamentos} agend.</div>}
                        {org.limite_profissionais == null && org.limite_agendamentos == null && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => openEdit(org)}
                          className="text-xs text-brand hover:underline font-medium">
                          Editar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-400 text-sm">Nenhuma empresa encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edição */}
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
              {/* Plano */}
              <div>
                <label className="label">Plano</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLANOS.map(p => (
                    <button key={p} onClick={() => setForm(f => ({ ...f, plan: p }))}
                      className={`py-2 rounded-xl text-sm font-medium border capitalize transition-all ${
                        form.plan === p ? 'border-brand bg-brand-light text-brand-dark' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trial até */}
              {form.plan === 'trial' && (
                <div>
                  <label className="label">Trial válido até</label>
                  <input type="date" className="input" value={form.trial_ends_at}
                    onChange={e => setForm(f => ({ ...f, trial_ends_at: e.target.value }))} />
                </div>
              )}

              {/* Limites extras */}
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <h3 className="text-sm font-medium text-amber-800 mb-3">Recursos adicionais pagos</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Profissionais extras</label>
                    <input type="number" min="0" className="input" placeholder="Ex: 2"
                      value={form.limite_profissionais}
                      onChange={e => setForm(f => ({ ...f, limite_profissionais: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Soma ao limite do plano</p>
                  </div>
                  <div>
                    <label className="label">Agendamentos extras/mês</label>
                    <input type="number" min="0" step="200" className="input" placeholder="Ex: 200"
                      value={form.limite_agendamentos}
                      onChange={e => setForm(f => ({ ...f, limite_agendamentos: e.target.value }))} />
                    <p className="text-xs text-gray-400 mt-1">Soma ao limite do plano</p>
                  </div>
                </div>
              </div>

              {/* Informações da conta */}
              <div className="p-4 bg-gray-50 rounded-xl text-xs text-gray-500 space-y-1.5">
                <div className="flex justify-between"><span>Cadastrado em:</span><strong>{format(new Date(editing.created_at), 'dd/MM/yyyy', { locale: ptBR })}</strong></div>
                <div className="flex justify-between"><span>Clientes:</span><strong>{editing._stats?.clientes}</strong></div>
                <div className="flex justify-between"><span>Agendamentos:</span><strong>{editing._stats?.agendamentos}</strong></div>
                <div className="flex justify-between"><span>Msgs WhatsApp:</span><strong>{editing._stats?.msgs}</strong></div>
                <div className="flex justify-between"><span>WhatsApp:</span><strong>{editing.wapi_instance_id ? 'Configurado' : 'Não configurado'}</strong></div>
                {editing.stripe_subscription_id && <div className="flex justify-between"><span>Stripe Sub:</span><strong className="font-mono text-xs">{editing.stripe_subscription_id}</strong></div>}
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
