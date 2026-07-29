'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, MessageSquare, Wallet, Banknote, CreditCard, QrCode, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Appointment } from '@/types'

const TZ = 'America/Sao_Paulo'

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'pill-green' },
  pending:   { label: 'Pendente',   cls: 'pill-yellow' },
  cancelled: { label: 'Cancelado',  cls: 'pill-red' },
  completed: { label: 'Concluído',  cls: 'pill-blue' },
  no_show:   { label: 'Faltou',     cls: 'pill-gray' },
}

const PAYMENT_METHODS = [
  { id: 'pix',           label: 'Pix',           icon: QrCode,     color: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'dinheiro',      label: 'Dinheiro',       icon: Banknote,   color: 'bg-green-50 text-green-600 border-green-200' },
  { id: 'cartao_debito', label: 'Cartão Débito',  icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'cartao_credito',label: 'Cartão Crédito', icon: CreditCard, color: 'bg-purple-50 text-purple-600 border-purple-200' },
]

const SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00']

export default function AgendaPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [allAppts, setAllAppts] = useState<Appointment[]>([])
  const [dayAppts, setDayAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [reagModal, setReagModal] = useState(false)
  const [reagAppt, setReagAppt] = useState<Appointment | null>(null)
  const [reagDate, setReagDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reagTime, setReagTime] = useState('')
  const [reagSaving, setReagSaving] = useState(false)
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [payAppt, setPayAppt] = useState<Appointment | null>(null)
  const [confirmFutureModal, setConfirmFutureModal] = useState(false)
  const [pendingComplete, setPendingComplete] = useState<Appointment | null>(null)
  const supabase = createClient()

  useEffect(() => { loadMonth() }, [currentMonth])

  useEffect(() => {
    const filtered = allAppts.filter(a => {
      const apptDate = new Date(a.starts_at).toLocaleDateString('pt-BR', { timeZone: TZ })
      const selDate = selectedDay.toLocaleDateString('pt-BR', { timeZone: TZ })
      return apptDate === selDate
    })
    setDayAppts(filtered.sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
  }, [selectedDay, allAppts])

  // Carregar slots disponíveis ao mudar data do reagendamento
  useEffect(() => {
    if (reagModal && reagAppt && reagDate) loadAvailableSlots()
  }, [reagDate, reagModal])

  async function loadMonth() {
    setLoading(true)
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const { data } = await supabase
      .from('appointments')
      .select('*, customer:customers(name, phone), professional:professionals(name), service:services(name, price, duration_min, color)')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
    setAllAppts(data || [])
    setLoading(false)
  }

  async function loadAvailableSlots() {
    if (!reagAppt) return
    setLoadingSlots(true)
    setReagTime('')

    const profId = (reagAppt as any).professional_id || reagAppt.professional_id
    const duration = (reagAppt.service as any)?.duration_min || 60

    // Buscar agendamentos do profissional no dia selecionado
    const dayStart = new Date(`${reagDate}T00:00:00-03:00`).toISOString()
    const dayEnd = new Date(`${reagDate}T23:59:59-03:00`).toISOString()
    const { data: ocupados } = await supabase
      .from('appointments')
      .select('starts_at, ends_at')
      .eq('professional_id', profId)
      .not('id', 'eq', reagAppt.id) // excluir o próprio agendamento
      .not('status', 'in', '(cancelled)')
      .gte('starts_at', dayStart)
      .lte('starts_at', dayEnd)

    const now = new Date()
    const isToday = reagDate === now.toLocaleDateString('en-CA', { timeZone: TZ })

    const slots = SLOTS.filter(slot => {
      const slotStart = new Date(`${reagDate}T${slot}:00-03:00`)
      const slotEnd = new Date(slotStart.getTime() + duration * 60000)

      // Filtrar horários passados se for hoje
      if (isToday && slotStart <= now) return false

      // Verificar conflito com outros agendamentos
      const temConflito = (ocupados || []).some(a => {
        const aStart = new Date(a.starts_at)
        const aEnd = new Date(a.ends_at)
        return slotStart < aEnd && slotEnd > aStart
      })

      return !temConflito
    })

    setAvailableSlots(slots)
    setLoadingSlots(false)
  }

  async function changeStatus(id: string, status: string) {
    if (status === 'completed') {
      const appt = dayAppts.find(a => a.id === id)
      if (appt) {
        // Verificar se o serviço ainda não aconteceu
        const agora = new Date()
        const inicioServico = new Date(appt.starts_at)
        if (inicioServico > agora) {
          setPendingComplete(appt)
          setConfirmFutureModal(true)
          return
        }
        setPayAppt(appt)
        setPayModal(true)
        return
      }
    }

    await supabase.from('appointments').update({ status }).eq('id', id)

    if (status === 'cancelled') {
      // Enviar WhatsApp de cancelamento e tratar resultado
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: id, type: 'cancellation' }),
        })
        const data = await res.json()
        if (data?.success) {
          toast.success('Agendamento cancelado. Cliente notificado via WhatsApp.')
        } else {
          toast.success('Agendamento cancelado.')
          toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
        }
      } catch {
        toast.success('Agendamento cancelado.')
        toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
      }
    } else {
      toast.success('Status atualizado.')
    }

    loadMonth()
  }

  async function confirmCompleteAnyway() {
    if (!pendingComplete) return
    setConfirmFutureModal(false)
    setPayAppt(pendingComplete)
    setPayModal(true)
    setPendingComplete(null)
  }

  async function confirmPayment(method: string) {
    if (!payAppt) return
    await supabase.from('appointments').update({ status: 'completed', payment_method: method }).eq('id', payAppt.id)
    toast.success('Atendimento concluído e pagamento registrado!')
    setPayModal(false)
    setPayAppt(null)
    loadMonth()
  }

  function openReag(a: Appointment) {
    setReagAppt(a)
    setReagDate(format(new Date(), 'yyyy-MM-dd'))
    setReagTime('')
    setAvailableSlots([])
    setReagModal(true)
  }

  async function saveReag() {
    if (!reagAppt || !reagDate || !reagTime) { toast.error('Selecione data e horário'); return }
    setReagSaving(true)
    const newStartsAt = `${reagDate}T${reagTime}:00-03:00`
    const duration = (reagAppt.service as any)?.duration_min || 60
    const newEndsAt = new Date(new Date(newStartsAt).getTime() + duration * 60000).toISOString()
    const { error } = await supabase.from('appointments').update({
      starts_at: new Date(newStartsAt).toISOString(),
      ends_at: newEndsAt,
      status: 'confirmed',
    }).eq('id', reagAppt.id)
    if (error) { toast.error('Erro ao reagendar'); setReagSaving(false); return }

    // Enviar WhatsApp e tratar resultado
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: reagAppt.id, type: 'rescheduling' }),
      })
      const data = await res.json()
      if (data?.success) {
        toast.success('Reagendado com sucesso! Cliente notificado via WhatsApp.')
      } else {
        toast.success('Reagendado com sucesso!')
        toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
      }
    } catch {
      toast.success('Reagendado com sucesso!')
      toast.error('Não foi possível enviar o WhatsApp. Verifique a conexão em Configurações.')
    }

    setReagModal(false)
    setReagSaving(false)
    loadMonth()
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = days[0].getDay()
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function hasDayAppts(day: Date) {
    return allAppts.some(a => {
      const apptDate = new Date(a.starts_at).toLocaleDateString('pt-BR', { timeZone: TZ })
      const dayDate = day.toLocaleDateString('pt-BR', { timeZone: TZ })
      return apptDate === dayDate && a.status !== 'cancelled'
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500 mt-0.5">Clique em um dia para ver os agendamentos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendário */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={16} /></button>
            <span className="text-sm font-semibold text-gray-900 capitalize">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekdays.map(d => <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map(day => {
              const isSelected = isSameDay(day, selectedDay)
              const hasAppts = hasDayAppts(day)
              const today = isToday(day)
              return (
                <button key={day.toISOString()} onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium transition-all relative
                    ${isSelected ? 'bg-brand text-white' : today ? 'border-2 border-brand text-brand' : 'hover:bg-gray-100 text-gray-700'}`}>
                  {day.getDate()}
                  {hasAppts && <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand'}`} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista do dia */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 text-sm capitalize">
              {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <span className="text-xs text-gray-400">{dayAppts.filter(a => a.status !== 'cancelled').length} agendamento(s)</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Carregando...</div>
          ) : dayAppts.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-sm text-gray-400">Nenhum agendamento neste dia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppts.map(a => {
                const s = STATUS[a.status] || STATUS.pending
                const isFuture = new Date(a.starts_at) > new Date()
                return (
                  <div key={a.id} className={`border border-gray-100 rounded-xl p-4 ${a.status === 'cancelled' ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-brand-light text-brand-dark text-xs font-semibold flex items-center justify-center shrink-0">
                          {(a.customer as any)?.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">{(a.customer as any)?.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {formatTime(a.starts_at)} · {(a.service as any)?.name} · {(a.professional as any)?.name}
                          </div>
                        </div>
                      </div>
                      <span className={`${s.cls} shrink-0 text-xs`}>{s.label}</span>
                    </div>

                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
                        <button onClick={() => changeStatus(a.id, 'completed')}
                          className="flex items-center gap-1.5 text-xs bg-brand-light text-brand-dark px-3 py-1.5 rounded-lg font-medium hover:bg-brand hover:text-white transition-colors">
                          <Wallet size={12} />
                          {isFuture ? 'Concluir (antecipado)' : 'Concluir e pagar'}
                        </button>
                        <button onClick={() => openReag(a)}
                          className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                          <MessageSquare size={12} /> Reagendar
                        </button>
                        <button onClick={() => changeStatus(a.id, 'no_show')}
                          className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                          Faltou
                        </button>
                        <button onClick={() => changeStatus(a.id, 'cancelled')}
                          className="flex items-center gap-1.5 text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg font-medium hover:bg-red-50 transition-colors">
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reagendamento */}
      {reagModal && reagAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">Reagendar</h2>
                <p className="text-xs text-gray-400 mt-0.5">{(reagAppt.customer as any)?.name} · {(reagAppt.service as any)?.name}</p>
              </div>
              <button onClick={() => setReagModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nova data</label>
                <input type="date" className="input" value={reagDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setReagDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Horário disponível</label>
                {loadingSlots ? (
                  <div className="text-sm text-gray-400 py-3 text-center">Verificando disponibilidade...</div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-sm text-amber-600 bg-amber-50 rounded-xl p-3 text-center">
                    Nenhum horário disponível nesta data para este profissional.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map(slot => (
                      <button key={slot} onClick={() => setReagTime(slot)}
                        className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                          reagTime === slot ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-700 hover:border-brand hover:text-brand'
                        }`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setReagModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveReag} disabled={reagSaving || !reagTime}>
                {reagSaving ? 'Salvando...' : 'Confirmar reagendamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {payModal && payAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">Forma de pagamento</h2>
                <p className="text-xs text-gray-400 mt-0.5">{(payAppt.service as any)?.name} · R${Number((payAppt.service as any)?.price || 0).toFixed(2)}</p>
              </div>
              <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.id} onClick={() => confirmPayment(pm.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 font-medium text-sm transition-all hover:scale-105 ${pm.color}`}>
                  <pm.icon size={22} />
                  {pm.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de conclusão antecipada */}
      {confirmFutureModal && pendingComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-amber-500" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Serviço ainda não ocorreu</h2>
                <p className="text-xs text-gray-400 mt-0.5">Este agendamento é para {formatTime(pendingComplete.starts_at)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">
              Você está concluindo um serviço que ainda não aconteceu. Deseja continuar mesmo assim?
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => { setConfirmFutureModal(false); setPendingComplete(null) }}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={confirmCompleteAnyway}>Concluir mesmo assim</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
