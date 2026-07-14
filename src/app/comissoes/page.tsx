'use client'
import PlanoGuard from '@/components/PlanoGuard'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Percent, FileText, Plus, X, Pencil, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

type Professional = { id: string; name: string; specialty: string | null }
type Service = { id: string; name: string; price: number }
type Commission = { id: string; professional_id: string; service_id: string | null; percentage: number; active: boolean }
type CommissionResult = {
  professional: Professional
  servicos: { nome: string; quantidade: number; valor_total: number; percentual: number; comissao: number }[]
  total_bruto: number
  total_comissao: number
}

const PLANOS_COM_PDF = ['pro', 'enterprise']
const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

export default function ComissoesPage() {
  const [tab, setTab] = useState<'config' | 'relatorio'>('relatorio')
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [plano, setPlano] = useState<string>('trial')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)
  const [results, setResults] = useState<CommissionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Commission | null>(null)
  const [form, setForm] = useState({ professional_id: '', service_id: '', percentage: '' })
  const [periodo, setPeriodo] = useState<'mensal' | 'quinzenal'>('mensal')
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'))
  const [quinzena, setQuinzena] = useState<1 | 2>(1)

  const supabase = createClient()
  const podePDF = PLANOS_COM_PDF.includes(plano) || userEmail === ADMIN_EMAIL

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserEmail(user.email || null)
    setUserLoaded(true)
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return
    setOrgId(profile.org_id)

    const { data: org } = await supabase.from('organizations').select('plan').eq('id', profile.org_id).single()
    if (org) setPlano(org.plan)

    const [p, s, c] = await Promise.all([
      supabase.from('professionals').select('id, name, specialty').eq('active', true).order('name'),
      supabase.from('services').select('id, name, price').eq('active', true).order('name'),
      supabase.from('commissions').select('*').order('created_at'),
    ])
    setProfessionals(p.data || [])
    setServices(s.data || [])
    setCommissions(c.data || [])
  }

  function getDateRange() {
    const [year, month] = mes.split('-').map(Number)
    const base = new Date(year, month - 1, 1)
    if (periodo === 'mensal') {
      return {
        start: new Date(year, month - 1, 1),
        end: new Date(year, month, 0, 23, 59, 59),
      }
    } else {
      if (quinzena === 1) {
        return { start: new Date(year, month - 1, 1), end: new Date(year, month - 1, 15, 23, 59, 59) }
      } else {
        return { start: new Date(year, month - 1, 16), end: new Date(year, month, 0, 23, 59, 59) }
      }
    }
  }

  async function calcular() {
    setLoading(true)
    const { start, end } = getDateRange()

    const { data: appts } = await supabase
      .from('appointments')
      .select('professional_id, service_id, service:services(name, price)')
      .eq('status', 'completed')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())

    if (!appts || appts.length === 0) {
      setResults([])
      setLoading(false)
      toast('Nenhum atendimento concluído no período.')
      return
    }

    const resultMap: Record<string, CommissionResult> = {}

    for (const appt of appts) {
      const prof = professionals.find(p => p.id === appt.professional_id)
      if (!prof) continue
      const service = appt.service as any
      const price = service?.price || 0
      const serviceName = service?.name || 'Serviço'
      const commEspecifica = commissions.find(c => c.professional_id === appt.professional_id && c.service_id === appt.service_id && c.active)
      const commGeral = commissions.find(c => c.professional_id === appt.professional_id && c.service_id === null && c.active)
      const comm = commEspecifica || commGeral
      const percentual = comm ? comm.percentage : 0

      if (!resultMap[prof.id]) {
        resultMap[prof.id] = { professional: prof, servicos: [], total_bruto: 0, total_comissao: 0 }
      }
      const existing = resultMap[prof.id].servicos.find(s => s.nome === serviceName && s.percentual === percentual)
      if (existing) {
        existing.quantidade++; existing.valor_total += price; existing.comissao += price * (percentual / 100)
      } else {
        resultMap[prof.id].servicos.push({ nome: serviceName, quantidade: 1, valor_total: price, percentual, comissao: price * (percentual / 100) })
      }
      resultMap[prof.id].total_bruto += price
      resultMap[prof.id].total_comissao += price * (percentual / 100)
    }

    setResults(Object.values(resultMap).sort((a, b) => b.total_comissao - a.total_comissao))
    setLoading(false)
  }

  async function saveCommission() {
    if (!form.professional_id || !form.percentage) { toast.error('Preencha todos os campos obrigatórios'); return }
    if (!orgId) return
    const payload = { org_id: orgId, professional_id: form.professional_id, service_id: form.service_id || null, percentage: parseFloat(form.percentage), active: true }
    if (editing) {
      const { error } = await supabase.from('commissions').update(payload).eq('id', editing.id)
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return }
      toast.success('Comissão atualizada!')
    } else {
      const { error } = await supabase.from('commissions').insert(payload)
      if (error) { toast.error('Já existe uma comissão para esse profissional/serviço'); return }
      toast.success('Comissão cadastrada!')
    }
    setModal(false)
    setForm({ professional_id: '', service_id: '', percentage: '' })
    init()
  }

  async function deleteCommission(id: string) {
    await supabase.from('commissions').delete().eq('id', id)
    toast.success('Comissão removida')
    init()
  }

  function openEdit(c: Commission) {
    setEditing(c)
    setForm({ professional_id: c.professional_id, service_id: c.service_id || '', percentage: String(c.percentage) })
    setModal(true)
  }

  function openNew() {
    setEditing(null)
    setForm({ professional_id: '', service_id: '', percentage: '' })
    setModal(true)
  }

  function exportPDF() {
    if (!podePDF) {
      toast.error('Exportação de PDF disponível apenas no plano Pro. Faça upgrade!')
      return
    }
    if (results.length === 0) { toast.error('Calcule as comissões primeiro'); return }
    const { start, end } = getDateRange()
    const periodoLabel = periodo === 'mensal'
      ? format(new Date(mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR })
      : `${quinzena}ª quinzena de ${format(new Date(mes + '-01'), "MMMM 'de' yyyy", { locale: ptBR })}`

    const linhas = results.map(r => `
      <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f9fafb;padding:10px 16px;font-weight:600;font-size:15px;display:flex;justify-content:space-between;">
          <span>${r.professional.name}</span>
          <span style="color:#00C896">Comissão: R$${r.total_comissao.toFixed(2)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:8px 16px;color:#6b7280">Serviço</th>
            <th style="text-align:right;padding:8px 16px;color:#6b7280">Qtd</th>
            <th style="text-align:right;padding:8px 16px;color:#6b7280">Valor total</th>
            <th style="text-align:right;padding:8px 16px;color:#6b7280">%</th>
            <th style="text-align:right;padding:8px 16px;color:#6b7280">Comissão</th>
          </tr></thead>
          <tbody>${r.servicos.map(s => `
            <tr style="border-top:1px solid #f3f4f6;">
              <td style="padding:8px 16px">${s.nome}</td>
              <td style="padding:8px 16px;text-align:right">${s.quantidade}</td>
              <td style="padding:8px 16px;text-align:right">R$${s.valor_total.toFixed(2)}</td>
              <td style="padding:8px 16px;text-align:right">${s.percentual}%</td>
              <td style="padding:8px 16px;text-align:right;color:#00C896;font-weight:500">R$${s.comissao.toFixed(2)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div style="padding:10px 16px;background:#f9fafb;display:flex;justify-content:space-between;font-size:13px;">
          <span>Total bruto: <strong>R$${r.total_bruto.toFixed(2)}</strong></span>
          <span>Total a pagar: <strong style="color:#00C896">R$${r.total_comissao.toFixed(2)}</strong></span>
        </div>
      </div>`).join('')

    const totalGeral = results.reduce((s, r) => s + r.total_comissao, 0)
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório de Comissões</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#111827;}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #00C896;">
        <div><h1 style="font-size:22px;margin:0">Relatório de Comissões</h1>
        <p style="color:#6b7280;margin:4px 0 0;font-size:14px;text-transform:capitalize">${periodoLabel}</p></div>
        <div style="text-align:right"><div style="font-size:13px;color:#6b7280">Total geral a pagar</div>
        <div style="font-size:24px;font-weight:700;color:#00C896">R$${totalGeral.toFixed(2)}</div></div>
      </div>${linhas}
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:24px;">
        Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — AgendaAI</p>
      </body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) win.print()
    URL.revokeObjectURL(url)
  }

  const profName = (id: string) => professionals.find(p => p.id === id)?.name || id
  const svcName = (id: string | null) => id ? (services.find(s => s.id === id)?.name || id) : 'Todos os serviços'

  return (
    <PlanoGuard planoMinimo="pro" mensagem="O módulo de Comissões está disponível apenas no plano Pro.">
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Comissões</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cálculo e relatório de comissões por profissional</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {([['relatorio', 'Relatório'], ['config', 'Configurar']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'relatorio' && (
        <div>
          <div className="card mb-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="label">Período</label>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['mensal', 'quinzenal'] as const).map(p => (
                    <button key={p} onClick={() => setPeriodo(p)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-all capitalize ${periodo === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Mês</label>
                <input type="month" className="input" value={mes} onChange={e => setMes(e.target.value)} />
              </div>
              {periodo === 'quinzenal' && (
                <div>
                  <label className="label">Quinzena</label>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {([1, 2] as const).map(q => (
                      <button key={q} onClick={() => setQuinzena(q)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-all ${quinzena === q ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                        {q}ª quinzena
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={calcular} disabled={loading} className="btn-primary">
                {loading ? 'Calculando...' : 'Calcular comissões'}
              </button>
              {results.length > 0 && (
                <div className="relative">
                  <button
                    onClick={exportPDF}
                    className={`flex items-center gap-2 ${podePDF ? 'btn-secondary' : 'btn-secondary opacity-60'}`}
                  >
                    {!podePDF && <Lock size={13} />}
                    <FileText size={15} />
                    {podePDF ? 'Exportar PDF' : 'PDF — Plano Pro'}
                  </button>
                </div>
              )}
            </div>
            {!podePDF && userLoaded && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center justify-between gap-4">
                <span>A exportação em PDF está disponível apenas no plano <strong>Pro</strong>.</span>
                <a href="/planos" className="btn-primary text-xs px-3 py-1.5 shrink-0">Fazer upgrade</a>
              </div>
            )}
          </div>

          {results.length === 0 && !loading && (
            <div className="card text-center py-16 text-gray-400 text-sm">
              Selecione o período e clique em "Calcular comissões" para ver o relatório.
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="card"><div className="text-xs text-gray-500 mb-1">Total a pagar</div>
                  <div className="text-2xl font-bold text-brand">R${results.reduce((s, r) => s + r.total_comissao, 0).toFixed(2)}</div></div>
                <div className="card"><div className="text-xs text-gray-500 mb-1">Faturamento bruto</div>
                  <div className="text-2xl font-bold text-gray-900">R${results.reduce((s, r) => s + r.total_bruto, 0).toFixed(2)}</div></div>
                <div className="card"><div className="text-xs text-gray-500 mb-1">Profissionais</div>
                  <div className="text-2xl font-bold text-gray-900">{results.length}</div></div>
                <div className="card"><div className="text-xs text-gray-500 mb-1">Total atendimentos</div>
                  <div className="text-2xl font-bold text-gray-900">{results.reduce((s, r) => s + r.servicos.reduce((ss, sv) => ss + sv.quantidade, 0), 0)}</div></div>
              </div>

              {results.map(r => (
                <div key={r.professional.id} className="card mb-4 overflow-hidden p-0">
                  <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-light text-brand-dark font-semibold text-sm flex items-center justify-center shrink-0">
                        {r.professional.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{r.professional.name}</div>
                        <div className="text-xs text-gray-400">{r.professional.specialty || 'Profissional'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-400">A receber</div>
                      <div className="text-lg font-bold text-brand">R${r.total_comissao.toFixed(2)}</div>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-xs text-gray-400 font-medium">Serviço</th>
                        <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-medium">Qtd</th>
                        <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-medium">Valor total</th>
                        <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-medium">%</th>
                        <th className="text-right px-5 py-2.5 text-xs text-gray-400 font-medium">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.servicos.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-700">{s.nome}</td>
                          <td className="px-5 py-3 text-right text-gray-500">{s.quantidade}</td>
                          <td className="px-5 py-3 text-right text-gray-700">R${s.valor_total.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right"><span className={s.percentual > 0 ? 'pill-green' : 'pill-gray'}>{s.percentual}%</span></td>
                          <td className="px-5 py-3 text-right font-medium text-brand">R${s.comissao.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-5 py-3 text-sm font-medium text-gray-500">Total</td>
                        <td className="px-5 py-3 text-right font-medium text-gray-900">R${r.total_bruto.toFixed(2)}</td>
                        <td></td>
                        <td className="px-5 py-3 text-right font-bold text-brand">R${r.total_comissao.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500">Configure o percentual de comissão por profissional e serviço.</p>
            <button className="btn-primary flex items-center gap-2" onClick={openNew}>
              <Plus size={16} /> Nova comissão
            </button>
          </div>
          <div className="card overflow-hidden p-0">
            {commissions.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                Nenhuma comissão configurada. Clique em "Nova comissão" para começar.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Profissional</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Serviço</th>
                    <th className="text-right px-5 py-3 text-xs text-gray-500 font-medium">Percentual</th>
                    <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map(c => (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{profName(c.professional_id)}</td>
                      <td className="px-5 py-3 text-gray-500">{svcName(c.service_id)}</td>
                      <td className="px-5 py-3 text-right"><span className="pill-green font-medium">{c.percentage}%</span></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-brand p-1"><Pencil size={14} /></button>
                          <button onClick={() => deleteCommission(c.id)} className="text-gray-400 hover:text-red-500 p-1"><X size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-4 p-4 bg-blue-50 rounded-xl text-sm text-blue-700 border border-blue-100">
            <strong>Regra de prioridade:</strong> se existir uma comissão específica para o serviço, ela tem prioridade sobre a comissão geral do profissional.
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-900">{editing ? 'Editar comissão' : 'Nova comissão'}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Profissional *</label>
                <select className="input" value={form.professional_id} onChange={e => setForm(f => ({ ...f, professional_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Serviço (deixe em branco para todos)</label>
                <select className="input" value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}>
                  <option value="">Todos os serviços</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — R${Number(s.price).toFixed(2)}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Percentual de comissão (%) *</label>
                <input type="number" min="0" max="100" step="0.5" className="input" placeholder="Ex: 30"
                  value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveCommission}>{editing ? 'Salvar' : 'Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PlanoGuard>
  )
}
