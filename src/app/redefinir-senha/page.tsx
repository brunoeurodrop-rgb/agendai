'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit() {
    if (!password || !confirm) { toast.error('Preencha todos os campos'); return }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    if (password !== confirm) { toast.error('As senhas não coincidem'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      toast.error('Erro ao redefinir senha. O link pode ter expirado.')
      return
    }

    toast.success('Senha redefinida com sucesso!')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand mb-1">Agenda<span className="text-gray-900">AI</span></div>
          <p className="text-gray-500 text-sm">Redefinição de senha</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h2 className="font-semibold text-gray-900 mb-1">Nova senha</h2>
          <p className="text-sm text-gray-500 mb-6">Digite e confirme sua nova senha.</p>
          <div className="space-y-4">
            <div>
              <label className="label">Nova senha</label>
              <input
                type="password"
                className="input"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Confirmar senha</label>
              <input
                type="password"
                className="input"
                placeholder="Digite a senha novamente"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <button
              className="btn-primary w-full py-3"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
