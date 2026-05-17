'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' })
  const router = useRouter()
  const supabase = createClient()

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  async function handleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) { toast.error('E-mail ou senha incorretos'); setLoading(false); return }
    router.push('/dashboard')
  }

  async function handleRegister() {
    if (!form.name || !form.email || !form.password || !form.company) {
      toast.error('Preencha todos os campos'); return
    }
    setLoading(true)
    const slug = form.company.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })
    if (authError || !authData.user) {
      toast.error(authError?.message || 'Erro ao criar conta'); setLoading(false); return
    }
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: form.company, slug: `${slug}-${Date.now()}`, plan: 'trial' })
      .select().single()
    if (orgError || !org) {
      toast.error('Erro ao criar empresa'); setLoading(false); return
    }
    await supabase.from('profiles').insert({
      id: authData.user.id,
      org_id: org.id,
      email: form.email,
      name: form.name,
      role: 'owner',
    })
    toast.success('Conta criada! Bem-vindo ao AgendaAI 🎉')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand mb-1">
            Agenda<span className="text-gray-900">AI</span>
          </div>
          <p className="text-gray-500 text-sm">Agendamento automático com WhatsApp</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {m === 'login' ? 'Entrar' : 'Criar conta grátis'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="label">Seu nome</label>
                  <input name="name" className="input" placeholder="Ex: Ana Silva" onChange={handle} />
                </div>
                <div>
                  <label className="label">Nome da empresa</label>
                  <input name="company" className="input" placeholder="Ex: Salão Beleza Real" onChange={handle} />
                </div>
              </>
            )}
            <div>
              <label className="label">E-mail</label>
              <input name="email" type="email" className="input" placeholder="voce@empresa.com" onChange={handle} />
            </div>
            <div>
              <label className="label">Senha</label>
              <input name="password" type="password" className="input" placeholder="Mínimo 6 caracteres" onChange={handle} />
            </div>

            <button
              className="btn-primary w-full py-3 mt-2"
              onClick={mode === 'login' ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar no painel' : 'Criar conta — 14 dias grátis'}
            </button>
          </div>

          {mode === 'register' && (
            <p className="text-center text-xs text-gray-400 mt-4">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          )}
        </div>

        {/* Prova social */}
        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          {[['98%', 'Redução de faltas'], ['+3h', 'Economizadas/dia'], ['2min', 'Para configurar']].map(([v, l]) => (
            <div key={l} className="bg-white/70 rounded-xl p-3 border border-gray-100">
              <div className="text-lg font-bold text-brand">{v}</div>
              <div className="text-xs text-gray-500">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
