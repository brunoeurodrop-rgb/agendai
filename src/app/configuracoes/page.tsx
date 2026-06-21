'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { MessageCircle, Save, CheckCircle, XCircle, Loader2, ExternalLink, QrCode, Building2, Upload, Phone, MapPin, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ConfiguracoesPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [tab, setTab] = useState<'empresa' | 'whatsapp'>('empresa')

  // Dados da empresa
  const [nome, setNome] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [savingEmpresa, setSavingEmpresa] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // WhatsApp
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
      .select('name, phone, address, logo_url, wapi_instance_id, wapi_token')
      .eq('id', profile.org_id)
      .single()
    if (org) {
      setNome(org.name || '')
      setPhone(org.phone || '')
      setAddress(org.address || '')
      setLogoUrl(org.logo_url || '')
      if (org.wapi_instance_id) {
        setInstanceId(org.wapi_instance_id)
        setToken(org.wapi_token || '')
        checkStatus(org.wapi_instance_id, org.wapi_token || '')
      }
    }
  }

  async function saveEmpresa() {
    if (!nome.trim()) { toast.error('Nome da empresa é obrigatório'); return }
    if (!orgId) return
    setSavingEmpresa(true)
    const { error } = await supabase.from('organizations').update({
      name: nome, phone: phone || null, address: address || null
    }).eq('id', orgId)
    setSavingEmpresa(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Dados atualizados com sucesso!')
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    if (file.size > 2 * 1024 * 1024) { toast.error('A imagem deve ter no máximo 2MB'); return }
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem válida'); return }

    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${orgId}/logo.${ext}`

      // Tentar remover arquivo anterior
      await supabase.storage.from('logos').remove([path])

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) {
        console.error('[Upload erro]', uploadError)
        toast.error('Erro ao fazer upload: ' + uploadError.message)
        setUploadingLogo(false)
        return
      }

      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path)
      const publicUrl = urlData.publicUrl + '?t=' + Date.now()

      const { error: updateError } = await supabase.from('organizations')
        .update({ logo_url: publicUrl }).eq('id', orgId)

      if (updateError) {
        toast.error('Erro ao salvar URL da logo')
        setUploadingLogo(false)
        return
      }

      setLogoUrl(publicUrl)
      toast.success('Logo atualizada com sucesso!')
    } catch (err: any) {
      console.error('[Upload catch]', err)
      toast.error('Erro inesperado no upload')
    }
    setUploadingLogo(false)
  }

  async function checkStatus(instId: string, tok: string) {
    if (!instId || !tok) return
    setStatus('loading')
    try {
      const res = await fetch(`https://api.w-api.app/v1/instance/device?instanceId=${instId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tok}` }
      })
      const data = await res.json()
      setStatus(res.ok && data.connectedPhone ? 'connected' : 'disconnected')
    } catch {
      setStatus('disconnected')
    }
  }

  async function saveWhatsapp() {
    if (!instanceId || !token) { toast.error('Preencha o Instance ID e o Token'); return }
    if (!orgId) return
    setSaving(true)
    const { error } = await supabase.from('organizations')
      .update({ wapi_instance_id: instanceId, wapi_token: token }).eq('id', orgId)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
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
      if (data.error === false && data.qrcode) {
        setQrCode(data.qrcode)
        toast.success('QR Code gerado! Escaneie com o WhatsApp.')
      } else if (data.connectedPhone) {
        setStatus('connected')
        toast.success('WhatsApp já está conectado!')
      } else {
        toast.error('Não foi possível gerar o QR Code.')
      }
    } catch {
      toast.error('Erro ao buscar QR Code. Tente novamente.')
    }
    setLoadingQr(false)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie os dados da sua empresa e integrações</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {([['empresa', '🏢 Dados da Empresa'], ['whatsapp', '💬 WhatsApp']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)}
            className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-xl space-y-5">

        {/* ABA EMPRESA */}
        {tab === 'empresa' && (
          <>
            {/* Logo */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-light to-white">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
                    <Building2 size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">Logo da empresa</h2>
                    <p className="text-xs text-gray-500">Aparece nos relatórios e na página pública</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-5">
                  <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Upload size={20} className="text-gray-300 mx-auto mb-1" />
                        <span className="text-xs text-gray-300">Sem logo</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-3">PNG, JPG ou WEBP. Máximo 2MB.</p>
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingLogo}
                      className="btn-primary flex items-center gap-2 text-sm"
                    >
                      {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploadingLogo ? 'Enviando...' : logoUrl ? 'Trocar logo' : 'Enviar logo'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                  </div>
                </div>
              </div>
            </div>

            {/* Dados */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <h2 className="font-semibold text-gray-900">Dados da empresa</h2>
                <p className="text-xs text-gray-500">O nome aparece nas mensagens automáticas do WhatsApp</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="label">Nome da empresa *</label>
                  <input className="input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Salão Beleza Real" />
                </div>
                <div>
                  <label className="label">Telefone de contato</label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                    <input className="input pl-9" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(21) 99999-9999" />
                  </div>
                </div>
                <div>
                  <label className="label">Endereço</label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
                    <input className="input pl-9" value={address} onChange={e => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade" />
                  </div>
                </div>
                <button onClick={saveEmpresa} disabled={savingEmpresa} className="btn-primary flex items-center gap-2 w-full justify-center">
                  {savingEmpresa ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {savingEmpresa ? 'Salvando...' : 'Salvar dados da empresa'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ABA WHATSAPP */}
        {tab === 'whatsapp' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-green-500 flex items-center justify-center">
                      <MessageCircle size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">WhatsApp Business</h2>
                      <p className="text-xs text-gray-500">Conecte o número da sua empresa via W-API</p>
                    </div>
                  </div>
                  <div>
                    {status === 'loading' && <Loader2 size={18} className="text-gray-400 animate-spin" />}
                    {status === 'connected' && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium bg-green-100 px-2.5 py-1 rounded-full">
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
              </div>

              <div className="p-5">
                <div className="p-4 bg-blue-50 rounded-xl text-sm text-blue-700 mb-5 border border-blue-100">
                  <p className="font-medium mb-2">Como configurar:</p>
                  <ol className="space-y-1 text-xs list-decimal list-inside">
                    <li>Acesse <a href="https://painel.w-api.app" target="_blank" rel="noopener noreferrer" className="underline font-medium">painel.w-api.app</a> e crie uma conta</li>
                    <li>Crie uma instância no plano Lite (R$19,90/mês) — <strong>7 dias grátis para testar</strong></li>
                    <li>Copie o <strong>Instance ID</strong> e o <strong>Token</strong></li>
                    <li>Cole os dados abaixo e clique em Salvar</li>
                    <li>Clique em <strong>Gerar QR Code</strong> e escaneie com o WhatsApp</li>
                  </ol>
                </div>

                {/* Configuração Assistida */}
                <div className="relative overflow-hidden rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 mb-5">
                  <div className="absolute top-0 right-0 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                    RECOMENDADO
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shrink-0">
                      <Sparkles size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-sm mb-1">Não quer configurar sozinho?</h3>
                      <p className="text-xs text-gray-600 mb-3">
                        Nossa equipe conecta seu WhatsApp por você — criação da instância, conexão, testes e configuração das automações. Tudo prontinho em poucos minutos.
                      </p>
                      <a
                        href="https://buy.stripe.com/test_28E7sEc6y9w85KkbqYcAo00"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                      >
                        <Sparkles size={14} /> Quero Configuração Assistida — R$79,90
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="label">Instance ID</label>
                    <input className="input font-mono text-sm" placeholder="Ex: LITE-W3QS38-2TW4K8" value={instanceId} onChange={e => setInstanceId(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Token da instância</label>
                    <input className="input font-mono text-sm" type="password" placeholder="Seu token da W-API" value={token} onChange={e => setToken(e.target.value)} />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button onClick={saveWhatsapp} disabled={saving} className="btn-primary flex items-center gap-2 flex-1 justify-center">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Salvando...' : 'Salvar credenciais'}
                  </button>
                  <button onClick={() => checkStatus(instanceId, token)} className="btn-secondary px-4">Verificar</button>
                </div>
              </div>
            </div>

            {instanceId && token && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-brand-light to-white">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
                      <QrCode size={18} className="text-white" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-gray-900">Conectar WhatsApp</h2>
                      <p className="text-xs text-gray-500">Escaneie o QR Code com o celular da empresa</p>
                    </div>
                  </div>
                </div>
                <div className="p-5">
                  {qrCode ? (
                    <div className="text-center">
                      <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-2xl mb-4">
                        <img src={qrCode} alt="QR Code WhatsApp" className="w-48 h-48" />
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        Abra o WhatsApp → <strong>Configurações → Aparelhos conectados → Conectar aparelho</strong>
                      </p>
                      <button onClick={getQrCode} className="btn-secondary text-sm">Gerar novo QR Code</button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
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
                          <button onClick={getQrCode} disabled={loadingQr} className="btn-primary flex items-center gap-2 mx-auto">
                            {loadingQr ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                            {loadingQr ? 'Gerando...' : 'Gerar QR Code'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <a href="https://painel.w-api.app" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-green-400 hover:bg-green-50 transition-all group">
              <div className="flex items-center gap-3">
                <MessageCircle size={18} className="text-green-500" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Criar conta na W-API</div>
                  <div className="text-xs text-gray-400">Plano Lite a partir de R$19,90/mês — 7 dias grátis</div>
                </div>
              </div>
              <ExternalLink size={16} className="text-gray-400 group-hover:text-green-500" />
            </a>
          </>
        )}
      </div>
    </div>
  )
}
