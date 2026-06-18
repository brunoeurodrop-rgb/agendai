'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, X, MessageSquare } from 'lucide-react'
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

  async function changeStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    toast.success(status === 'completed' ? 'Marcado como concluído' : status === 'cancelled' ? 'Agendamento cancelado' : 'Status atualizado')
    loadMonth()
    if (status === 'cancelled') {
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, type: 'cancellation' }),
      })
    }
  }

  function openReag(a: Appointment) {
    setReagAppt(a)
    setReagDate(format(new Date(), 'yyyy-MM-dd'))
    setReagTime('')
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
    fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: reagAppt.id, type: 'rescheduling' }),
    })
    toast.success('Reagendado com sucesso! WhatsApp enviado.')
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
      return apptDate === dayDate
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Agenda</h1>
        <p className="text-sm text-gray-500 mt-0.5">Clique em um dia para ver os agendamentos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendário */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
            <span className="font-medium text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {weekdays.map(d => <div key={d} className="text-center text-xs text-gray-400 font-medium py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={i} />)}
            {days.map(day => {
              const selected = isSameDay(day, selectedDay)
              const today = isToday(day)
              const hasAppt = hasDayAppts(day)
              return (
                <button key={day.toString()} onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-all
                    ${selected ? 'bg-brand text-white font-semibold' : today ? 'bg-brand-light text-brand-dark font-semibold' : 'hover:bg-gray-100 text-gray-700'}`}>
                  {format(day, 'd')}
                  {hasAppt && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-brand'}`} />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Agendamentos do dia */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">
            {selectedDay.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', timeZone: TZ })}
            {isToday(selectedDay) && <span className="ml-2 pill-green text-xs">Hoje</span>}
          </h2>
          {loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>
          ) : dayAppts.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">Nenhum agendamento neste dia.</div>
          ) : (
            <div className="space-y-3">
              {dayAppts.map(a => {
                const s = STATUS[a.status] || STATUS.pending
                return (
                  <div key={a.id} className="p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark font-semibold text-xs flex items-center justify-center shrink-0">
                          {(a.customer as any)?.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{(a.customer as any)?.name}</div>
                          <div className="text-xs text-gray-400">
                            {formatTime(a.starts_at)} · {(a.service as any)?.name} · {(a.professional as any)?.name}
                          </div>
                        </div>
                      </div>
                      <span className={s.cls}>{s.label}</span>
                    </div>

                    {/* Observações */}
                    {a.notes && (
                      <div className="flex items-start gap-1.5 mt-2 mb-2 px-1">
                        <MessageSquare size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-gray-500 italic">{a.notes}</p>
                      </div>
                    )}

                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {a.status === 'pending' && (
                          <button onClick={() => changeStatus(a.id, 'confirmed')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-brand-light text-brand-dark hover:bg-brand hover:text-white transition-colors">
                            Confirmar
                          </button>
                        )}
                        <button onClick={() => openReag(a)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                          Reagendar
                        </button>
                        <button onClick={() => changeStatus(a.id, 'completed')}
                          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          Concluído
                        </button>
                        <button onClick={() => changeStatus(a.id, 'cancelled')}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
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
              <h2 className="font-semibold text-gray-900">Reagendar</h2>
              <button onClick={() => setReagModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              <strong>{(reagAppt.customer as any)?.name}</strong> — {(reagAppt.service as any)?.name}<br />
              <span className="text-xs text-gray-400">Horário atual: {formatTime(reagAppt.starts_at)}</span>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nova data</label>
                <input type="date" className="input" value={reagDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => setReagDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Novo horário</label>
                <div className="grid grid-cols-5 gap-2">
                  {SLOTS.map(t => (
                    <button key={t} onClick={() => setReagTime(t)}
                      className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                        reagTime === t ? 'border-brand bg-brand text-white' : 'border-gray-200 hover:border-brand hover:text-brand'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-brand-light rounded-xl text-xs text-brand-dark">
              O cliente receberá uma mensagem de reagendamento pelo WhatsApp automaticamente.
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setReagModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={saveReag} disabled={reagSaving}>
                {reagSaving ? 'Salvando...' : 'Confirmar reagendamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
