'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Search, Plus, Phone, Mail, X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Customer } from '@/types'

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })
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
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data || [])
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', phone: '', email: '', notes: '' })
    setModal(true)
  }

  function openEdit(c: Customer) {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, email: c.email || '', notes: c.notes || '' })
    setModal(true)
  }

  async function save() {
    if (!form.name || !form.phone) { toast.error('Nome e telefone são obrigatórios'); return }
    if (!orgId) { toast.error('Sessão expirada. Faça login novamente.'); return }

    if (editing) {
      const { error } = await supabase.from('customers').update({
        name: form.name,
        phone: form.phone.replace(/\D/g, ''),
        email: form.email || null,
        notes: form.notes || null,
      }).eq('id', editing.id)
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Cliente atualizado!')
    } else {
      const { error } = await supabase.from('customers').insert({
        org_id: orgId,
        name: form.name,
        phone: form.phone.replace(/\D/g, ''),
        email: form.email || null,
        notes: form.notes || null,
      })
      if (error) { toast.error('Erro: ' + error.message); return }
      toast.success('Cliente cadastrado!')
    }
    setModal(false)
    setForm({ name: '', phone: '', email: '', notes: '' })
    load()
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} clientes cadastrados</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openNew}>
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nome, telefone ou e-mail..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden p-0">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Nome</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">Telefone</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium hidden lg:table-cell">E-mail</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark text-xs font-semibold flex items-center justify-center shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden md:table-cell">
                    <div className="flex items-center gap-1.5"><Phone size={13} className="text-gray-400" />{c.phone}</div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 hidden lg:table-cell">
                    {c.email
                      ? <div className="flex items-center gap-1.5"><Mail size={13} className="text-gray-400" />{c.email}</div>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button onClick={() => openEdit(c)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand border border-gray-200 hover:border-brand px-2.5 py-1.5 rounded-lg transition-all">
                      <Pencil size={12} /> Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing ? 'Editar cliente' : 'Novo cliente'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nome completo *</label>
                <input className="input" placeholder="Ex: Maria Clara" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">WhatsApp *</label>
                <input className="input" placeholder="(21) 99999-9999" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="label">E-mail</label>
                <input className="input" type="email" placeholder="Opcional" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="label">Observações</label>
                <input className="input" placeholder="Opcional" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={save}>
                {editing ? 'Salvar alterações' : 'Cadastrar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
