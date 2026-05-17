'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, XCircle, Clock, RefreshCw, Bell } from 'lucide-react'

const TIPOS: Record<string, { label: string; icon: any; bg: string; color: string }> = {
  confirmation: { label: 'Confirmação enviada', icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  reminder_24h: { label: 'Lembrete 24h antes',  icon: Clock,       bg: 'bg-amber-50',   color: 'text-amber-600' },
  reminder_1h:  { label: 'Lembrete 1h antes',   icon: Bell,        bg: 'bg-blue-50',    color: 'text-blue-600' },
  cancellation: { label: 'Cancelamento',         icon: XCircle,     bg: 'bg-red-50',     color: 'text-red-500' },
  rescheduling: { label: 'Reagendamento',        icon: RefreshCw,   bg: 'bg-purple-50',  color: 'text-purple-600' },
}

export default function NotificacoesPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('messages_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs(data || [])
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Notificações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Histórico de mensagens WhatsApp enviadas</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : logs.length === 0 ? (
        <div className="card text-center py-16 text-gray-400 text-sm">
          Nenhuma notificação ainda. Elas aparecem aqui conforme os agendamentos forem criados.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {logs.map(l => {
            const t = TIPOS[l.type] || TIPOS.confirmation
            const Icon = t.icon
            return (
              <div key={l.id} className="card flex items-center gap-4">
                <div className={`${t.bg} p-2.5 rounded-xl shrink-0`}>
                  <Icon size={18} className={t.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900">{t.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{l.phone}</div>
                </div>
                <div className="text-right shrink-0">
                  <span className={l.status === 'sent' ? 'pill-green' : l.status === 'failed' ? 'pill-red' : 'pill-yellow'}>
                    {l.status === 'sent' ? 'Enviada' : l.status === 'failed' ? 'Falha' : 'Pendente'}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {l.created_at ? format(new Date(l.created_at), "dd/MM HH:mm", { locale: ptBR }) : ''}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
