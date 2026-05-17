'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { MessageCircle, Check, X, Clock, RefreshCw, Bell } from 'lucide-react'
import toast from 'react-hot-toast'
import type { MessageLog } from '@/types'

const MSG_TYPES: Record<string, { label: string; icon: any; desc: string }> = {
  confirmation: { label: 'Confirmação de agendamento', icon: Check, desc: 'Enviada imediatamente após agendar' },
  reminder_24h: { label: 'Lembrete 24h antes', icon: Bell, desc: 'Enviada 1 dia antes do horário' },
  reminder_1h:  { label: 'Lembrete 1h antes', icon: Clock, desc: 'Enviada 1 hora antes do horário' },
  cancellation: { label: 'Aviso de cancelamento', icon: X, desc: 'Enviada quando o agendamento é cancelado' },
  rescheduling: { label: 'Reagendamento', icon: RefreshCw, desc: 'Enviada quando há mudança de horário' },
}

const EXAMPLE_MSG = `Olá, Maria! 😊

Seu agendamento foi *confirmado*!

📅 *Data:* terça-feira, 13 de maio
⏰ *Horário:* 09:00
✂️ *Serviço:* Corte Feminino
👩 *Profissional:* Juliana

Estamos te esperando! ✨

_Salão Beleza Real_`

export default function WhatsAppPage() {
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [loading, setLoading] = useState(true)
  const [connected] = useState(!!process.env.NEXT_PUBLIC_SUPABASE_URL)
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

  const sent = logs.filter(l => l.status === 'sent').length
  const failed = logs.filter(l => l.status === 'failed').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-0.5">Automações e histórico de mensagens</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status das automações */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={16} className="text-brand" />
            <h2 className="font-medium text-gray-900 text-sm">Automações configuradas</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(MSG_TYPES).map(([key, val]) => {
              const Icon = val.icon
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="w-8 h-8 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{val.label}</div>
                    <div className="text-xs text-gray-400">{val.desc}</div>
                  </div>
                  <span className="pill-green text-xs shrink-0">Ativo</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Preview de mensagem */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54]">
            <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-brand-dark font-bold text-xs shrink-0">SA</div>
            <div>
              <div className="text-white text-sm font-medium">Salão Beleza Real</div>
              <div className="flex items-center gap-1.5 text-xs text-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Online
              </div>
            </div>
          </div>
          <div className="bg-[#ECE5DD] p-4 min-h-[240px] flex flex-col gap-2">
            <div className="bg-white rounded-xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">{EXAMPLE_MSG}</pre>
              <div className="text-right text-[10px] text-gray-400 mt-1">09:00 ✓✓</div>
            </div>
            <div className="bg-[#DCF8C6] rounded-xl rounded-tr-sm px-4 py-3 max-w-[85%] ml-auto shadow-sm">
              <p className="text-xs text-gray-800">Obrigada! Estarei lá 😊</p>
              <div className="text-right text-[10px] text-gray-400 mt-1">09:01 ✓✓</div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas + Log */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total enviadas', value: logs.length, color: 'text-gray-900' },
          { label: 'Entregues', value: sent, color: 'text-brand' },
          { label: 'Falhas', value: failed, color: 'text-red-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-medium text-gray-900 text-sm">Histórico de mensagens</h2>
        </div>
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-sm">Carregando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">Nenhuma mensagem enviada ainda.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Tipo</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium hidden md:table-cell">Telefone</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium hidden lg:table-cell">Data</th>
                <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-700">{MSG_TYPES[l.type]?.label || l.type}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{l.phone}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {l.sent_at ? new Date(l.sent_at).toLocaleString('pt-BR') : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={l.status === 'sent' ? 'pill-green' : l.status === 'failed' ? 'pill-red' : 'pill-yellow'}>
                      {l.status === 'sent' ? 'Enviada' : l.status === 'failed' ? 'Falha' : 'Pendente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
