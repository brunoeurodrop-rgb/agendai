'use client'
import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function AssinaturaCanceladaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50/20 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento cancelado</h1>
        <p className="text-gray-500 text-sm mb-6">
          Nenhuma cobrança foi realizada. Você pode assinar um plano quando quiser.
        </p>
        <Link href="/planos" className="btn-primary inline-block px-8 py-3">
          Ver planos
        </Link>
      </div>
    </div>
  )
}
