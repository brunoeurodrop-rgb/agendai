import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

async function checkAdmin() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email === ADMIN_EMAIL
}

export async function GET() {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const admin = createAdminSupabaseClient()

  const { data: orgsData } = await admin
    .from('organizations')
    .select('*, profiles(email, name)')
    .order('created_at', { ascending: false })

  if (!orgsData) return NextResponse.json({ orgs: [] })

  const orgsWithStats = await Promise.all(orgsData.map(async org => {
    const [c, a, m] = await Promise.all([
      admin.from('customers').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      admin.from('appointments').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
      admin.from('messages_log').select('*', { count: 'exact', head: true }).eq('org_id', org.id),
    ])
    return { ...org, _stats: { clientes: c.count || 0, agendamentos: a.count || 0, msgs: m.count || 0 } }
  }))

  return NextResponse.json({ orgs: orgsWithStats })
}

export async function PATCH(req: NextRequest) {
  if (!await checkAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { org_id, plan, trial_ends_at, limite_profissionais, limite_agendamentos } = body

  if (!org_id) return NextResponse.json({ error: 'org_id obrigatório' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const payload: any = { plan }
  if (trial_ends_at) payload.trial_ends_at = trial_ends_at
  payload.limite_profissionais = limite_profissionais ?? null
  payload.limite_agendamentos = limite_agendamentos ?? null

  const { error } = await admin.from('organizations').update(payload).eq('id', org_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
