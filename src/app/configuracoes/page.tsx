'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { MessageCircle, Save, CheckCircle, XCircle, Loader2, ExternalLink, QrCode } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfiguracoesPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'connected' | 'disconnected'>('idle')
  const [saving, setSaving] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const supabase = createClient()

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return
    setOrgId(profile.org_id)

    const { data: org } = await supabase
      .from('organizations')
      .select('wapi_instance_id, wapi_token')
      .eq('id', profile.org_id)
      .single()

    if (org?.wapi_instance_id) {
      setInstanceId(org.wapi_instance_id)
      setToken(org.wapi_token || '')
      checkStatus(org.wapi_instance_id, org.wapi_token || '')
    }
  }

  async function checkStatus(instId: string, tok: string) {
    if (!instId || !tok) return
    setStatus('loading')
    try {
      const res = await fetch(`https://api.w-api.app/v1/instance/status?instanceId=${instId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tok}` }
      })
      const data = await res.json()
      console.log('[W-API Status]', data)
      if (res.ok && (data.status === 'connected' || data.connected === true || data.state === 'open' || data.error === false)) {
        setStatus('connected')
      } else {
        setStatus('disconnected')
      }
    } catch {
      setStatus('disconnected')
    }
  }

  async function save() {
    if (!instanceId || !token) { toast.error('Preencha o Instance ID e o Token'); return }
    if (!orgId) return
    setSaving(true)

    const { error } = await supabase
      .from('organizations')
      .update({ wapi_instance_id: instanceId, wapi_token: token })
      .eq('id', orgId)

    setSaving(false)

    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return }

    toast.success('Credenciais salvas!')
    checkStatus(instanceId, token)
  }

  async function getQrCode() {
    if (!instanceId || !token) { toast.error('Salve as credenciais primeiro'); return }
    setLoadingQr(true)
    setQrCode(null)
    try {
      const res = await fetch(`https://api.w-api.app/v1/instance/qr-code?instanceId=${instanceId}&image=disable`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      console.log('[W-API QR]', data)
      if (data.error === false && data.qrcode) {
        setQrCode(data.qrcode)
        toast.success('QR Code gerado! Escaneie com o WhatsApp.')
      } else if (data.status === 'connected' || data.connected === true) {
        setStatus('connected')
        toast.success('WhatsApp já está conectado!')
      } else {
        toast.error('Não foi possível gerar o QR Code. Verifique as credenciais.')
      }
    } catch (err) {
      console.error('[QR Code]', err)
      toast.error('Erro ao buscar QR Code. Tente novamente.')
    }
    setLoadingQr(false)
  }

  async function sendTest() {
    if (!instanceId || !token) { toast.error('Configure o WhatsApp primeiro'); return }
    const res = await fetch(`https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ phone: '55' + instanceId.replace(/\D/g, '').slice(-11), message: 'Teste de conexão AgendaAI ✅' })
    })
    if (res.ok) toast.success('Mensagem de teste enviada!')
    else toast.error('Falha no teste. Verifique se o WhatsApp está conectado.')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure o WhatsApp da sua empresa</p>
      </div>

      <div className="max-w-xl space-y-6">
        {/* Card WhatsApp */}
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageCircle size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">WhatsApp Business</h2>
              <p className="text-xs text-gray-400">Conecte o número da sua empresa via W-API</p>
            </div>
            <div className="ml-auto">
              {status === 'loading' && <Loader2 size={18} className="text-gray-400 animate-spin" />}
              {status === 'connected' && (
                <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full">
                  <CheckCircle size={13} /> Conectado
                </div>
              )}
              {status === 'disconnected' && (
                <div className="flex items-center gap-1.5 text-xs text-red-500 font-medium bg-red-50 px-2.5 py-1 rounded-full">
                  <XCircle size={13} /> Desconectado
                </div>
              )}
            </div>
          </div>

          {/* Instruções */}
          <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700 mb-5 border border-blue-100">
            <p className="font-medium mb-2">Como configurar:</p>
            <ol className="space-y-1 text-xs list-decimal list-inside">
              <li>Acesse <a href="https://painel.w-api.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">painel.w-api.app</a> e crie uma conta</li>
              <li>Crie uma instância no plano Lite (R$19,90/mês)</li>
              <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong></li>
              <li>Cole os dados abaixo e clique em Salvar</li>
              <li>Clique em <strong>Gerar QR Code</strong> e escaneie com o WhatsApp</li>
            </ol>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Instance ID</label>
              <input
                className="input font-mono text-sm"
                placeholder="Ex: LITE-W3QS38-2TW4K8"
                value={instanceId}
                onChange={e => setInstanceId(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Token da instância</label>
              <input
                className="input font-mono text-sm"
                type="password"
                placeholder="Seu token da W-API"
                value={token}
                onChange={e => setToken(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex items-center gap-2 flex-1"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Salvando...' : 'Salvar credenciais'}
            </button>
            <button
              onClick={() => checkStatus(instanceId, token)}
              className="btn-secondary px-4"
              title="Verificar status"
            >
              Verificar
            </button>
          </div>
        </div>

        {/* QR Code */}
        {instanceId && token && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center">
                <QrCode size={20} className="text-brand" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Conectar WhatsApp</h2>
                <p className="text-xs text-gray-400">Escaneie o QR Code com o celular da empresa</p>
              </div>
            </div>

            {qrCode ? (
              <div className="text-center">
                <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-2xl mb-4">
                  <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48" />
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Abra o WhatsApp → <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong>
                </p>
                <button onClick={getQrCode} className="btn-secondary text-sm">
                  Gerar novo QR Code
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                {status === 'connected' ? (
                  <div>
                    <CheckCircle size={40} className="text-green-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 font-medium">WhatsApp conectado!</p>
                    <p className="text-xs text-gray-400 mt-1">As mensagens automáticas estão ativas.</p>
                  </div>
                ) : (
                  <div>
                    <QrCode size={40} className="text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 mb-4">Clique para gerar o QR Code de conexão</p>
                    <button
                      onClick={getQrCode}
                      disabled={loadingQr}
                      className="btn-primary flex items-center gap-2 mx-auto"
                    >
                      {loadingQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                      {loadingQr ? 'Gerando...' : 'Gerar QR Code'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Link W-API */}
        <a
          href="https://painel.w-api.app"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-brand hover:bg-brand-light/20 transition-all group"
        >
          <div className="flex items-center gap-3">
            <MessageCircle size={18} className="text-green-500" />
            <div>
              <div className="text-sm font-medium text-gray-900">Criar conta na W-API</div>
              <div className="text-xs text-gray-400">Plano Lite a partir de R$19,90/mês</div>
            </div>
          </div>
          <ExternalLink size={16} className="text-gray-400 group-hover:text-brand" />
        </a>
      </div>
    </div>
  )
}
