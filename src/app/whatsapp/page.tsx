'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle, XCircle, Clock, RefreshCw, Bell, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const TIPOS: Record<string, { label: string; icon: any; bg: string; color: string }> = {
  confirmation: { label: 'Confirmação enviada', icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  reminder_24h: { label: 'Lembrete 24h antes',  icon: Clock,       bg: 'bg-amber-50',   color: 'text-amber-600' },
  reminder_1h:  { label: 'Lembrete 1h antes',   icon: Bell,        bg: 'bg-blue-50',    color: 'text-blue-600' },
  cancellation: { label: 'Cancelamento',         icon: XCircle,     bg: 'bg-red-50',     color: 'text-red-500' },
  rescheduling: { label: 'Reagendamento',        icon: RefreshCw,   bg: 'bg-purple-50',  color: 'text-purple-600' },
}

export default function WhatsAppPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('Olá! Esta é uma mensagem de teste do AgendaAI. 🎉')
  const [sending, setSending] = useState(false)
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

  async function sendTest() {
    if (!testPhone) { toast.error('Digite um número de WhatsApp'); return }
    setSending(true)
    const res = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone, message: testMsg }),
    })
    const data = await res.json()
    setSending(false)
    if (data.success) {
      toast.success('Mensagem enviada com sucesso!')
    } else {
      toast.error('Falha ao enviar. Verifique o número e tente novamente.')
    }
  }

  const sent = logs.filter(l => l.status === 'sent').length
  const failed = logs.filter(l => l.status === 'failed').length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-0.5">Automações e histórico de mensagens</p>
      </div>

      {/* Teste de envio */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Send size={16} className="text-brand" />
          <h2 className="font-medium text-gray-900 text-sm">Enviar mensagem de teste</h2>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="label">Número WhatsApp (com DDD)</label>
            <input className="input" placeholder="Ex: 21999999999" value={testPhone}
              onChange={e => setTestPhone(e.target.value)} />
          </div>
          <div>
            <label className="label">Mensagem</label>
            <textarea className="input" rows={3} value={testMsg}
              onChange={e => setTestMsg(e.target.value)} />
          </div>
          <button onClick={sendTest} disabled={sending} className="btn-primary w-fit flex items-center gap-2">
            <Send size={14} />
            {sending ? 'Enviando...' : 'Enviar teste'}
          </button>
        </div>
      </div>

      {/* Automações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={16} className="text-brand" />
            <h2 className="font-medium text-gray-900 text-sm">Automações ativas</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(TIPOS).map(([key, val]) => {
              const Icon = val.icon
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className={`w-8 h-8 rounded-lg ${val.bg} flex items-center justify-center shrink-0`}>
                    <Icon size={14} className={val.color} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{val.label}</div>
                  </div>
                  <span className="pill-green text-xs">Ativo</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54]">
            <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-brand-dark font-bold text-xs shrink-0">SA</div>
            <div>
              <div className="text-white text-sm font-medium">Seu Estabelecimento</div>
              <div className="flex items-center gap-1.5 text-xs text-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span> Conectado
              </div>
            </div>
          </div>
          <div className="bg-[#ECE5DD] p-4 min-h-[200px] flex flex-col gap-2">
            <div className="bg-white rounded-xl rounded-tl-sm px-4 py-3 max-w-[85%] shadow-sm">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
{`Olá, João! 😊

Seu agendamento foi *confirmado*!

📅 *Data:* terça-feira, 13 de maio
⏰ *Horário:* 09:00
✂️ *Serviço:* Corte Feminino
👩 *Profissional:* Juliana

Estamos te esperando! ✨`}
              </pre>
              <div className="text-right text-[10px] text-gray-400 mt-1">09:00 ✓✓</div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
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
                  <td className="px-5 py-3 text-gray-700">{TIPOS[l.type]?.label || l.type}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell">{l.phone}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {l.sent_at ? format(new Date(l.sent_at), "dd/MM HH:mm", { locale: ptBR }) : '—'}
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
