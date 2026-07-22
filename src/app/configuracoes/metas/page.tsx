'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { Target, Save, Loader2, Info, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const GOAL_TYPES = [
  { id: 'revenue', label: 'Faturamento mensal', prefix: 'R$', suffix: '', placeholder: '10000', description: 'Meta de receita para o mês atual' },
  { id: 'appointments', label: 'Atendimentos no mês', prefix: '', suffix: 'atend.', placeholder: '100', description: 'Número de atendimentos a realizar' },
  { id: 'new_clients', label: 'Novos clientes', prefix: '', suffix: 'clientes', placeholder: '20', description: 'Novos clientes a cadastrar no mês' },
  { id: 'attendance_rate', label: 'Taxa de comparecimento', prefix: '', suffix: '%', placeholder: '90', description: 'Percentual de clientes que comparecem' },
]

export default function MetasPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [goals, setGoals] = useState<Record<string, { value: string; isSuggestion: boolean }>>({})
  const [prevRevenue, setPrevRevenue] = useState<number | null>(null)
  const currentMonth = format(new Date(), 'yyyy-MM')
  const supabase = createClient()

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return
    setOrgId(profile.org_id)

    // Buscar metas do mês atual
    const { data: existingGoals } = await supabase
      .from('goals')
      .select('*')
      .eq('org_id', profile.org_id)
      .eq('month', currentMonth)

    // Calcular faturamento do mês anterior para sugestão
    const prevMonth = subMonths(new Date(), 1)
    const prevStart = new Date(Date.UTC(prevMonth.getFullYear(), prevMonth.getMonth(), 1)).toISOString()
    const prevEnd = new Date(Date.UTC(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59)).toISOString()

    const { data: prevAppts } = await supabase
      .from('appointments')
      .select('service:services(price)')
      .eq('org_id', profile.org_id)
      .eq('status', 'completed')
      .gte('starts_at', prevStart)
      .lte('starts_at', prevEnd)

    const prevRev = (prevAppts || []).reduce((s, a: any) => s + (a.service?.price || 0), 0)
    setPrevRevenue(prevRev)

    // Montar estado das metas
    const goalsMap: Record<string, { value: string; isSuggestion: boolean }> = {}
    for (const type of GOAL_TYPES) {
      const existing = existingGoals?.find(g => g.type === type.id)
      if (existing) {
        goalsMap[type.id] = { value: String(existing.target_value), isSuggestion: existing.is_suggestion }
      } else if (type.id === 'revenue' && prevRev > 0) {
        // Sugestão automática: faturamento anterior + 10%
        goalsMap[type.id] = { value: String(Math.ceil(prevRev * 1.1)), isSuggestion: true }
      } else {
        goalsMap[type.id] = { value: '', isSuggestion: false }
      }
    }
    setGoals(goalsMap)
    setLoading(false)
  }

  async function save() {
    if (!orgId) return
    setSaving(true)
    const month = currentMonth

    for (const type of GOAL_TYPES) {
      const val = goals[type.id]?.value
      if (!val || isNaN(parseFloat(val))) continue

      const isSuggestion = goals[type.id]?.isSuggestion || false

      await supabase.from('goals').upsert({
        org_id: orgId,
        type: type.id,
        period: 'monthly',
        target_value: parseFloat(val),
        month,
        is_suggestion: isSuggestion,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,type,month' })
    }

    setSaving(false)
    toast.success('Metas salvas com sucesso!')
  }

  function handleChange(typeId: string, value: string) {
    setGoals(g => ({ ...g, [typeId]: { value, isSuggestion: false } }))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Carregando...</div>

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center">
          <Target size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Metas do mês</h1>
          <p className="text-sm text-gray-500 capitalize">{format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}</p>
        </div>
      </div>

      {/* Aviso sobre sugestão */}
      {prevRevenue !== null && prevRevenue > 0 && goals['revenue']?.isSuggestion && (
        <div className="flex items-start gap-2 mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
          <Info size={15} className="mt-0.5 shrink-0" />
          <span>A meta de faturamento foi <strong>sugerida automaticamente</strong> com base no mês anterior (R${prevRevenue.toFixed(2)}) + 10%. Ajuste conforme desejar.</span>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {GOAL_TYPES.map(type => {
          const goal = goals[type.id]
          return (
            <div key={type.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-medium text-gray-900 text-sm">{type.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{type.description}</div>
                </div>
                {goal?.isSuggestion && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0 ml-3">Sugerida</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {type.prefix && <span className="text-sm font-medium text-gray-500">{type.prefix}</span>}
                <input
                  type="number"
                  min="0"
                  step={type.id === 'attendance_rate' ? '1' : type.id === 'revenue' ? '100' : '1'}
                  className="input flex-1"
                  placeholder={type.placeholder}
                  value={goal?.value || ''}
                  onChange={e => handleChange(type.id, e.target.value)}
                />
                {type.suffix && <span className="text-sm font-medium text-gray-500">{type.suffix}</span>}
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
        {saving ? 'Salvando...' : 'Salvar metas'}
      </button>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp size={14} className="text-brand" />
          <span className="text-xs font-semibold text-gray-700">Em breve — mais tipos de meta</span>
        </div>
        <p className="text-xs text-gray-500">Futuramente você poderá definir metas semanais, por profissional e por serviço.</p>
      </div>
    </div>
  )
}
