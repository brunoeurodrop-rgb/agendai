'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Service, Professional, Customer } from '@/types'

const TZ = 'America/Sao_Paulo'

const SLOTS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']

function getTodayBrasilia() {
  return new Date().toLocaleDateString('pt-BR', { timeZone: TZ }).split('/').reverse().join('-')
}

function getNowBrasilia() {
  return new Date().toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
}

function isSlotInPast(date: string, time: string): boolean {
  const today = getTodayBrasilia()
  if (date > today) return false
  if (date < today) return true
  // Mesmo dia — verificar horário
  const now = getNowBrasilia()
  return time <= now
}

export default function AgendamentoPage() {
  const [step, setStep] = useState(1)
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookedSlots, setBookedSlots] = useState<string[]>([])

  const [sel, setSel] = useState({
    service: null as Service | null,
    professional: null as Professional | null,
    customer: null as Customer | null,
    date: getTodayBrasilia(),
    time: '',
    notes: '',
  })
  const [customerSearch, setCustomerSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('services').select('*').eq('active', true).order('name').then(({ data }) => setServices(data || []))
    supabase.from('professionals').select('*').eq('active', true).order('name').then(({ data }) => setProfessionals(data || []))
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers(data || []))
  }, [])

  useEffect(() => {
    if (!sel.professional || !sel.date) return
    // Buscar horários ocupados no dia selecionado em horário de Brasília
    const start = new Date(sel.date + 'T00:00:00-03:00').toISOString()
    const end = new Date(sel.date + 'T23:59:59-03:00').toISOString()
    supabase
      .from('appointments')
      .select('starts_at')
      .eq('professional_id', sel.professional.id)
      .not('status', 'in', '(cancelled)')
      .gte('starts_at', start)
      .lte('starts_at', end)
      .then(({ data }) => {
        const times = (data || []).map(a =>
          new Date(a.starts_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
        )
        setBookedSlots(times)
      })
  }, [sel.professional, sel.date])

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  )

  async function confirm() {
    if (!sel.service || !sel.professional || !sel.customer || !sel.date || !sel.time) {
      toast.error('Preencha todos os campos'); return
    }

    // Verificar se data/hora não é no passado
    if (isSlotInPast(sel.date, sel.time)) {
      toast.error('Não é possível agendar para uma data ou horário no passado.')
      return
    }

    setLoading(true)
    // Usar offset de Brasília (-03:00)
    const starts_at = `${sel.date}T${sel.time}:00-03:00`

    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: sel.customer.id,
        professional_id: sel.professional.id,
        service_id: sel.service.id,
        starts_at,
        notes: sel.notes,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { toast.error(data.error || 'Erro ao agendar'); return }
    toast.success('Agendamento confirmado! WhatsApp enviado automaticamente. 🎉')
    setStep(1)
    setSel({ service: null, professional: null, customer: null, date: getTodayBrasilia(), time: '', notes: '' })
    setCustomerSearch('')
  }

  const steps = ['Serviço', 'Profissional', 'Data e hora', 'Cliente', 'Confirmar']

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Novo agendamento</h1>
        <p className="text-sm text-gray-500 mt-0.5">Preencha os dados em ordem</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={s} className="flex items-center gap-2 shrink-0">
              <div className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-brand' : done ? 'text-gray-400' : 'text-gray-300'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs
                  ${done ? 'bg-brand text-white' : active ? 'bg-brand-light text-brand border border-brand' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? <Check size={12} /> : n}
                </div>
                {s}
              </div>
              {i < steps.length - 1 && <ChevronRight size={14} className="text-gray-200 shrink-0" />}
            </div>
          )
        })}
      </div>

      <div className="max-w-xl">
        {/* Step 1: Serviço */}
        {step === 1 && (
          <div className="card">
            <h2 className="font-medium text-gray-900 mb-4">Qual serviço?</h2>
            <div className="grid grid-cols-1 gap-2">
              {services.map(s => (
                <button key={s.id} onClick={() => { setSel(f => ({ ...f, service: s })); setStep(2) }}
                  className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-brand hover:bg-brand-light/30 transition-all text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color || '#00C896' }} />
                    <div>
                      <div className="font-medium text-sm text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.duration_min} min</div>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">R${Number(s.price).toFixed(2)}</span>
                </button>
              ))}
              {services.length === 0 && <p className="text-sm text-gray-400">Nenhum serviço ativo. Cadastre em Serviços primeiro.</p>}
            </div>
          </div>
        )}

        {/* Step 2: Profissional */}
        {step === 2 && (
          <div className="card">
            <h2 className="font-medium text-gray-900 mb-4">Qual profissional?</h2>
            <div className="grid grid-cols-1 gap-2">
              {professionals.map(p => (
                <button key={p.id} onClick={() => { setSel(f => ({ ...f, professional: p })); setStep(3) }}
                  className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-brand hover:bg-brand-light/30 transition-all text-left">
                  <div className="w-9 h-9 rounded-full bg-brand-light text-brand-dark font-semibold text-sm flex items-center justify-center shrink-0">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-400">{p.specialty || 'Profissional'}</div>
                  </div>
                </button>
              ))}
              {professionals.length === 0 && <p className="text-sm text-gray-400">Nenhum profissional ativo.</p>}
            </div>
            <button onClick={() => setStep(1)} className="btn-secondary w-full mt-4">Voltar</button>
          </div>
        )}

        {/* Step 3: Data e hora */}
        {step === 3 && (
          <div className="card">
            <h2 className="font-medium text-gray-900 mb-4">Quando?</h2>
            <div className="mb-4">
              <label className="label">Data</label>
              <input type="date" className="input" value={sel.date}
                min={getTodayBrasilia()}
                onChange={e => setSel(f => ({ ...f, date: e.target.value, time: '' }))} />
            </div>
            <div>
              <label className="label">Horário disponível</label>
              <div className="grid grid-cols-5 gap-2">
                {SLOTS.map(t => {
                  const booked = bookedSlots.includes(t)
                  const past = isSlotInPast(sel.date, t)
                  const disabled = booked || past
                  return (
                    <button key={t} disabled={disabled}
                      onClick={() => setSel(f => ({ ...f, time: t }))}
                      className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                        sel.time === t ? 'border-brand bg-brand text-white' :
                        disabled ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' :
                        'border-gray-200 hover:border-brand hover:text-brand'
                      }`}>
                      {t}
                    </button>
                  )
                })}
              </div>
              {sel.date === getTodayBrasilia() && (
                <p className="text-xs text-gray-400 mt-2">Horários anteriores ao atual estão desabilitados.</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1">Voltar</button>
              <button onClick={() => sel.time && setStep(4)} disabled={!sel.time} className="btn-primary flex-1">Continuar</button>
            </div>
          </div>
        )}

        {/* Step 4: Cliente */}
        {step === 4 && (
          <div className="card">
            <h2 className="font-medium text-gray-900 mb-4">Para qual cliente?</h2>
            <input className="input mb-3" placeholder="Buscar por nome ou telefone..."
              value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} />
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {filteredCustomers.map(c => (
                <button key={c.id} onClick={() => { setSel(f => ({ ...f, customer: c })); setStep(5) }}
                  className="flex items-center gap-3 w-full p-2.5 border border-gray-100 rounded-xl hover:border-brand hover:bg-brand-light/30 transition-all text-left">
                  <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark font-semibold text-xs flex items-center justify-center shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  </div>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <p className="text-sm text-gray-400 py-4 text-center">Nenhum cliente encontrado.</p>
              )}
            </div>
            <button onClick={() => setStep(3)} className="btn-secondary w-full mt-4">Voltar</button>
          </div>
        )}

        {/* Step 5: Confirmação */}
        {step === 5 && sel.service && sel.professional && sel.customer && (
          <div className="card">
            <h2 className="font-medium text-gray-900 mb-4">Confirmar agendamento</h2>
            <div className="space-y-3 mb-5">
              {[
                ['Serviço', sel.service.name, `R$${Number(sel.service.price).toFixed(2)} · ${sel.service.duration_min}min`],
                ['Profissional', sel.professional.name, sel.professional.specialty || ''],
                ['Data', new Date(sel.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }), ''],
                ['Horário', sel.time, ''],
                ['Cliente', sel.customer.name, sel.customer.phone],
              ].map(([label, value, sub]) => (
                <div key={label} className="flex justify-between items-start py-2.5 border-b border-gray-50">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{value}</div>
                    {sub && <div className="text-xs text-gray-400">{sub}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-4">
              <label className="label">Observações (opcional)</label>
              <input className="input" placeholder="Ex: cliente preferiu tintura orgânica"
                value={sel.notes} onChange={e => setSel(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="p-3 bg-brand-light rounded-xl text-xs text-brand-dark mb-4">
              Mensagem de confirmação será enviada automaticamente pelo WhatsApp.
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(4)} className="btn-secondary flex-1">Voltar</button>
              <button onClick={confirm} disabled={loading} className="btn-primary flex-1">
                {loading ? 'Agendando...' : 'Confirmar agendamento'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
