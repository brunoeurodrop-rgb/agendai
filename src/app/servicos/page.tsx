'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Plus, X, Clock, DollarSign, Pencil, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { getLimite } from '@/lib/plano-limites'
import type { Service } from '@/types'

const COLORS = ['#00C896','#7F77DD','#D4537E','#378ADD','#F59E0B','#10B981','#EF4444','#6366F1']

export default function ServiçosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [plano, setPlano] = useState<string>('trial')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Service | null>(null)
  const [form, setForm] = useState({ name: '', description: '', duration_min: '60', price: '', color: '#00C896', active: true })
  const supabase = createClient()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return
    setOrgId(profile.org_id)
    const { data: org } = await supabase.from('organizations').select('plan').eq('id', profile.org_id).single()
    if (org) setPlano(org.plan)
    load()
  }

  async function load() {
    const { data } = await supabase.from('services').select('*').order('name')
    setServices(data || [])
  }

  function openNew() {
    const limite = getLimite(plano, 'servicos')
    const ativos = services.filter(s => s.active).length
    if (ativos >= limite) {
      toast.error(`Seu plano ${plano === 'trial' ? 'gratuito' : plano} permite até ${limite} serviços. Faça upgrade para adicionar mais.`)
      return
    }
    setEditing(null)
    setForm({ name: '', description: '', duration_min: '60', price: '', color: '#00C896', active: true })
    setModal(true)
  }

  function openEdit(s: Service) {
    setEditing(s)
    setForm({ name: s.name, description: s.description || '', duration_min: String(s.duration_min), price: String(s.price), color: s.color || '#00C896', active: s.active })
    setModal(true)
  }

  async function save() {
    if (!form.name || !form.price) { toast.error('Nome e preço são obrigatórios'); return }
    if (!orgId) return
    const payload = {
      org_id: orgId,
      name: form.name,
      description: form.description || null,
      duration_min: parseInt(form.duration_min),
      price: parseFloat(form.price),
      color: form.color,
      active: form.active,
    }
    if (editing) {
      const { error } = await supabase.from('services').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar'); return }
      toast.success('Serviço atualizado!')
    } else {
      const { error } = await supabase.from('services').insert(payload)
      if (error) { toast.error('Erro ao salvar'); return }
      toast.success('Serviço cadastrado!')
    }
    setModal(false); load()
  }

  async function toggleActive(s: Service) {
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    load()
  }

  const limite = getLimite(plano, 'servicos')
  const ativos = services.filter(s => s.active).length
  const atingiuLimite = ativos >= limite

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500 mt-0.5">{ativos} de {limite >= 99 ? '∞' : limite} serviços ativos</p>
        </div>
        <button className={`btn-primary flex items-center gap-2 ${atingiuLimite ? 'opacity-60' : ''}`} onClick={openNew}>
          {atingiuLimite ? <Lock size={16} /> : <Plus size={16} />}
          {atingiuLimite ? 'Limite atingido' : 'Novo serviço'}
        </button>
      </div>

      {atingiuLimite && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center justify-between gap-4">
          <span>Seu plano <strong>{plano === 'trial' ? 'gratuito' : plano}</strong> permite até {limite} serviços ativos. Faça upgrade.</span>
          <a href="/planos" className="btn-primary text-xs px-3 py-1.5 shrink-0">Ver planos</a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(s => (
          <div key={s.id} className={`card relative ${!s.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color || '#00C896' }} />
                <h3 className="font-medium text-gray-900">{s.name}</h3>
              </div>
              <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-gray-700 p-1"><Pencil size={14} /></button>
            </div>
            {s.description && <p className="text-xs text-gray-400 mb-3">{s.description}</p>}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-500"><Clock size={13} className="text-gray-400" />{s.duration_min} min</div>
              <div className="flex items-center gap-1.5 text-gray-700 font-medium"><DollarSign size={13} className="text-gray-400" />R${Number(s.price).toFixed(2)}</div>
            </div>
            <button onClick={() => toggleActive(s)} className={`mt-3 text-xs px-2.5 py-1 rounded-full font-medium ${s.active ? 'pill-green' : 'pill-gray'}`}>
              {s.active ? 'Ativo' : 'Pausado'}
            </button>
          </div>
        ))}
        {services.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400 text-sm">Nenhum serviço cadastrado ainda.</div>}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing ? 'Editar serviço' : 'Novo serviço'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nome *</label><input className="input" placeholder="Ex: Corte Feminino" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><label className="label">Descrição</label><input className="input" placeholder="Opcional" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Duração (min)</label><input className="input" type="number" value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))} /></div>
                <div><label className="label">Preço (R$) *</label><input className="input" type="number" step="0.01" placeholder="0,00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
              </div>
              <div>
                <label className="label">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={save}>{editing ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
