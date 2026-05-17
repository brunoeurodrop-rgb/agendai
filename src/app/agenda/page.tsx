'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Appointment } from '@/types'

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'pill-green' },
  pending:   { label: 'Pendente',   cls: 'pill-yellow' },
  cancelled: { label: 'Cancelado',  cls: 'pill-red' },
  completed: { label: 'Concluído',  cls: 'pill-blue' },
  no_show:   { label: 'Faltou',     cls: 'pill-gray' },
}

export default function AgendaPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [allAppts, setAllAppts] = useState<Appointment[]>([])
  const [dayAppts, setDayAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadMonth() }, [currentMonth])

  useEffect(() => {
    const filtered = allAppts.filter(a => isSameDay(new Date(a.starts_at), selectedDay))
    setDayAppts(filtered.sort((a, b) => a.starts_at.localeCompare(b.starts_at)))
  }, [selectedDay, allAppts])

  async function loadMonth() {
    setLoading(true)
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const { data } = await supabase
      .from('appointments')
      .select('*, customer:customers(name), professional:professionals(name), service:services(name,price,color)')
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
    setAllAppts(data || [])
    setLoading(false)
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    loadMonth()
    if (status === 'cancelled') {
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: id, type: 'cancellation' }),
      })
    }
  }

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
  const firstDayOfWeek = days[0].getDay()
  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function hasDayAppts(day: Date) {
    return allAppts.some(a => isSameDay(new Date(a.starts_at), day))
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
          {/* Navegação mês */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <span className="font-medium text-gray-900 capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Header dias da semana */}
          <div className="grid grid-cols-7 mb-1">
            {weekdays.map(d => (
              <div key={d} className="text-center text-xs text-gray-400 font-medium py-2">{d}</div>
            ))}
          </div>

          {/* Dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={i} />)}
            {days.map(day => {
              const selected = isSameDay(day, selectedDay)
              const today = isToday(day)
              const hasAppt = hasDayAppts(day)
              return (
                <button key={day.toString()} onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-all
                    ${selected ? 'bg-brand text-white font-semibold' :
                      today ? 'bg-brand-light text-brand-dark font-semibold' :
                      'hover:bg-gray-100 text-gray-700'}`}>
                  {format(day, 'd')}
                  {hasAppt && (
                    <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${selected ? 'bg-white' : 'bg-brand'}`} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Agendamentos do dia */}
        <div className="card">
          <h2 className="font-medium text-gray-900 mb-4 text-sm">
            {format(selectedDay, "d 'de' MMMM", { locale: ptBR })}
            {isToday(selectedDay) && <span className="ml-2 pill-green text-xs">Hoje</span>}
          </h2>

          {loading ? (
            <div className="text-sm text-gray-400 py-8 text-center">Carregando...</div>
          ) : dayAppts.length === 0 ? (
            <div className="text-sm text-gray-400 py-8 text-center">
              Nenhum agendamento neste dia.
            </div>
          ) : (
            <div className="space-y-3">
              {dayAppts.map(a => {
                const s = STATUS[a.status] || STATUS.pending
                return (
                  <div key={a.id} className="p-3 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark font-semibold text-xs flex items-center justify-center shrink-0">
                          {(a.customer as any)?.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-sm text-gray-900">{(a.customer as any)?.name}</div>
                          <div className="text-xs text-gray-400">
                            {format(new Date(a.starts_at), 'HH:mm')} · {(a.service as any)?.name} · {(a.professional as any)?.name}
                          </div>
                        </div>
                      </div>
                      <span className={s.cls}>{s.label}</span>
                    </div>
                    {a.status !== 'cancelled' && a.status !== 'completed' && (
                      <div className="flex gap-2 mt-2">
                        {a.status === 'pending' && (
                          <button onClick={() => changeStatus(a.id, 'confirmed')}
                            className="text-xs px-2.5 py-1 rounded-lg bg-brand-light text-brand-dark hover:bg-brand hover:text-white transition-colors">
                            Confirmar
                          </button>
                        )}
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
    </div>
  )
}
