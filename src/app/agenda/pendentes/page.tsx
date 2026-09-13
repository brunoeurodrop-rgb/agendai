'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Wallet, Banknote, CreditCard, QrCode, X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const TZ = 'America/Sao_Paulo'

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: TZ
  })
}

function diasAtraso(dateStr: string): number {
  const now = new Date()
  const appt = new Date(dateStr)
  return Math.floor((now.getTime() - appt.getTime()) / (1000 * 60 * 60 * 24))
}

const PAYMENT_METHODS = [
  { id: 'pix',           label: 'Pix',           icon: QrCode,     color: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'dinheiro',      label: 'Dinheiro',       icon: Banknote,   color: 'bg-green-50 text-green-600 border-green-200' },
  { id: 'cartao_debito', label: 'Cartão Débito',  icon: CreditCard, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'cartao_credito',label: 'Cartão Crédito', icon: CreditCard, color: 'bg-purple-50 text-purple-600 border-purple-200' },
]

export default function PendentesPage() {
  const [pendentes, setPendentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState(false)
  const [payAppt, setPayAppt] = useState<any | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('appointments')
      .select('*, customer:customers(name, phone, notes), professional:professionals(name), service:services(name, price, duration_min)')
      .lt('ends_at', new Date().toISOString())
      .in('status', ['confirmed', 'pending'])
      .order('starts_at', { ascending: false })
    setPendentes(data || [])
    setLoading(false)
  }

  async function changeStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    if (status === 'cancelled') {
      try {
        const res = await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: id, type: 'cancellation' }),
        })
        const data = await res.json()
        if (data?.success) {
          toast.success('Cancelado. Cliente notificado via WhatsApp.')
        } else {
          toast.success('Agendamento cancelado.')
          toast.error('Não foi possível enviar o WhatsApp.')
        }
      } catch {
        toast.success('Agendamento cancelado.')
      }
    } else if (status === 'no_show') {
      toast.success('Marcado como faltou.')
    }
    load()
  }

  async function confirmPayment(method: string) {
    if (!payAppt) return
    await supabase.from('appointments').update({ status: 'completed', payment_method: method }).eq('id', payAppt.id)
    toast.success('Atendimento concluído e pagamento registrado!')
    setPayModal(false)
    setPayAppt(null)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-amber-500" />
            Pendentes de conclusão
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Agendamentos que passaram da data sem registro de conclusão
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary text-sm">← Dashboard</Link>
      </div>

      {loading ? (
        <div className="card text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : pendentes.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle size={40} className="text-brand mx-auto mb-3" />
          <p className="font-medium text-gray-900 mb-1">Tudo em dia!</p>
          <p className="text-sm text-gray-400">Nenhum agendamento pendente de conclusão.</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
            <AlertTriangle size={15} className="shrink-0" />
            <span><strong>{pendentes.length} agendamento{pendentes.length !== 1 ? 's' : ''}</strong> aguardando registro.</span>
          </div>

          <div className="space-y-3">
            {pendentes.map(a => {
              const dias = diasAtraso(a.ends_at)
              return (
                <div key={a.id} className="card border-l-4 border-l-amber-400">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-semibold text-sm flex items-center justify-center shrink-0">
                        {a.customer?.name?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{a.customer?.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{a.customer?.phone}</div>
                        {a.customer?.notes && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                            ⚠️ {a.customer.notes}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        dias === 0 ? 'bg-amber-100 text-amber-700' :
                        dias <= 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {dias === 0 ? 'Hoje' : `${dias} dia${dias !== 1 ? 's' : ''} atrás`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <div className="text-gray-400 mb-0.5">Serviço</div>
                      <div className="font-medium text-gray-900">{a.service?.name}</div>
                      <div className="text-gray-400">R${Number(a.service?.price || 0).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <div className="text-gray-400 mb-0.5">Profissional</div>
                      <div className="font-medium text-gray-900">{a.professional?.name}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5 col-span-2">
                      <div className="text-gray-400 mb-0.5">Data e horário</div>
                      <div className="font-medium text-gray-900">{formatDateTime(a.starts_at)}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                    <button onClick={() => { setPayAppt(a); setPayModal(true) }}
                      className="flex items-center gap-1.5 text-xs bg-brand text-white px-3 py-1.5 rounded-lg font-medium hover:bg-brand-dark transition-colors">
                      <Wallet size={12} /> Concluir e registrar pagamento
                    </button>
                    <button onClick={() => changeStatus(a.id, 'no_show')}
                      className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      Faltou
                    </button>
                    <button onClick={() => changeStatus(a.id, 'cancelled')}
                      className="text-xs border border-red-100 text-red-500 px-3 py-1.5 rounded-lg font-medium hover:bg-red-50 transition-colors">
                      Cancelar
                    </button>
                    <Link href={`/agenda?date=${new Date(a.starts_at).toLocaleDateString('en-CA', { timeZone: TZ })}`}
                      className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                      Ver na agenda
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal de Pagamento */}
      {payModal && payAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-semibold text-gray-900">Forma de pagamento</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {payAppt.customer?.name} · {payAppt.service?.name} · R${Number(payAppt.service?.price || 0).toFixed(2)}
                </p>
              </div>
              <button onClick={() => setPayModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
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
    </div>
  )
}
