import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { customer_id, professional_id, service_id, starts_at, notes } = body

    if (!customer_id || !professional_id || !service_id || !starts_at) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Buscar duração do serviço para calcular ends_at
    const { data: service } = await supabase
      .from('services')
      .select('duration_min')
      .eq('id', service_id)
      .single()

    if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

    const startsAt = new Date(starts_at)
    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60000)

    // Verificar conflito de horário
    const { data: conflict } = await supabase
      .from('appointments')
      .select('id')
      .eq('professional_id', professional_id)
      .not('status', 'in', '(cancelled)')
      .lt('starts_at', endsAt.toISOString())
      .gt('ends_at', startsAt.toISOString())

    if (conflict && conflict.length > 0) {
      return NextResponse.json({ error: 'Horário já ocupado para este profissional' }, { status: 409 })
    }

    // Buscar org_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', session.user.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    // Criar agendamento
    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        org_id: profile.org_id,
        customer_id,
        professional_id,
        service_id,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: 'confirmed',
        notes: notes || null,
      })
      .select()
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
    }

    // Disparar mensagem de confirmação no WhatsApp (async, não bloqueia resposta)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    fetch(`${baseUrl}/api/whatsapp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appointmentId: appt.id, type: 'confirmation' }),
    }).catch(console.error)

    return NextResponse.json({ success: true, appointment: appt })
  } catch (err) {
    console.error('[API Appointments POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const professionalId = searchParams.get('professional_id')

    let query = supabase
      .from('appointments')
      .select('*, customer:customers(*), professional:professionals(*), service:services(*)')
      .order('starts_at')

    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end   = new Date(date); end.setHours(23, 59, 59, 999)
      query = query.gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString())
    }
    if (professionalId) query = query.eq('professional_id', professionalId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ appointments: data })
  } catch (err) {
    console.error('[API Appointments GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
