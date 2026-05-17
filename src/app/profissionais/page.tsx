'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Plus, X, Pencil, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Professional } from '@/types'

export default function ProfissionaisPage() {
  const [list, setList] = useState<Professional[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Professional | null>(null)
  const [form, setForm] = useState({ name: '', specialty: '', phone: '', email: '', bio: '', active: true })
  const supabase = createClient()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (profile) setOrgId(profile.org_id)
    load()
  }

  async function load() {
    const { data } = await supabase.from('professionals').select('*').order('name')
    setList(data || [])
  }

  function openNew() { setEditing(null); setForm({ name: '', specialty: '', phone: '', email: '', bio: '', active: true }); setModal(true) }
  function openEdit(p: Professional) { setEditing(p); setForm({ name: p.name, specialty: p.specialty || '', phone: p.phone || '', email: p.email || '', bio: p.bio || '', active: p.active }); setModal(true) }

  async function save() {
    if (!form.name) { toast.error('Nome obrigatorio'); return }
    if (!orgId) { toast.error('Sessao expirada. Faca login novamente.'); return }
    const payload = { org_id: orgId, name: form.name, specialty: form.specialty || null, phone: form.phone || null, email: form.email || null, bio: form.bio || null, active: form.active }
    if (editing) {
      const { error } = await supabase.from('professionals').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Profissional atualizado!')
    } else {
      const { error } = await supabase.from('professionals').insert(payload)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Profissional cadastrado!')
    }
    setModal(false); load()
  }

  async function toggle(p: Professional) {
    await supabase.from('professionals').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Profissionais</h1>
          <p className="text-sm text-gray-500 mt-0.5">{list.filter(p => p.active).length} ativos</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus size={16} /> Novo profissional</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(p => (
          <div key={p.id} className={`card ${!p.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-light text-brand-dark font-semibold flex items-center justify-center text-sm shrink-0">{p.name.slice(0,2).toUpperCase()}</div>
                <div><div className="font-medium text-gray-900">{p.name}</div><div className="text-xs text-gray-400">{p.specialty || 'Profissional'}</div></div>
              </div>
              <button onClick={() => openEdit(p)} className="text-gray-400 hover:text-gray-700 p-1"><Pencil size={14} /></button>
            </div>
            {p.bio && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{p.bio}</p>}
            <div className="space-y-1.5 mb-3">
              {p.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={12} className="text-gray-400" />{p.phone}</div>}
              {p.email && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={12} className="text-gray-400" />{p.email}</div>}
            </div>
            <button onClick={() => toggle(p)} className={`text-xs px-2.5 py-1 rounded-full font-medium ${p.active ? 'pill-green' : 'pill-gray'}`}>{p.active ? 'Ativo' : 'Inativo'}</button>
          </div>
        ))}
        {list.length === 0 && <div className="col-span-3 text-center py-16 text-gray-400 text-sm">Nenhum profissional cadastrado ainda.</div>}
      </div>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing ? 'Editar profissional' : 'Novo profissional'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Juliana Lima" /></div>
              <div><label className="label">Especialidade</label><input className="input" value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} placeholder="Ex: Cabeleireira" /></div>
              <div><label className="label">WhatsApp</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(21) 99999-9999" /></div>
              <div><label className="label">E-mail</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Opcional" /></div>
              <div><label className="label">Bio</label><input className="input" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Pequena descricao (opcional)" /></div>
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
