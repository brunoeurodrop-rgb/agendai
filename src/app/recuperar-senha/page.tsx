'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    if (!email.trim()) {
      toast.error('Digite seu e-mail antes de continuar.')
      return
    }
    if (!email.includes('@')) {
      toast.error('Digite um e-mail válido.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://vermillion-palmier-d545a3.netlify.app/redefinir-senha',
    })

    setLoading(false)

    if (error) {
      console.error('[Recuperar senha]', error)
      toast.error('Erro ao enviar e-mail. Tente novamente.')
      return
    }

    setEnviado(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-brand mb-1">Agenda<span className="text-gray-900">AI</span></div>
          <p className="text-gray-500 text-sm">Recuperação de senha</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {enviado ? (
            <div className="text-center">
              <div className="text-5xl mb-4">📧</div>
              <h2 className="font-semibold text-gray-900 mb-2">E-mail enviado!</h2>
              <p className="text-sm text-gray-500 mb-2">
                Enviamos um link para <strong>{email}</strong>.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Clique no link do e-mail para criar uma nova senha. Verifique também a pasta de spam.
              </p>
              <button
                onClick={() => { setEnviado(false); setEmail('') }}
                className="text-xs text-gray-400 hover:text-brand mb-4 block mx-auto transition-colors"
              >
                Não recebi o e-mail — tentar novamente
              </button>
              <Link href="/login" className="btn-primary inline-block px-8 py-2.5">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-gray-900 mb-1">Esqueceu sua senha?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="label">E-mail cadastrado</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    autoFocus
                  />
                </div>
                <button
                  className="btn-primary w-full py-3"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                </button>
              </div>
              <div className="text-center mt-4">
                <Link href="/login" className="text-sm text-gray-400 hover:text-brand transition-colors">
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
