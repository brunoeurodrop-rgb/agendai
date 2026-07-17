import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { sendWhatsAppMessage, buildMessage } from '@/lib/whatsapp'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

function isPlanActive(plan: string, trialEndsAt: string | null, userEmail: string): boolean {
  if (userEmail === ADMIN_EMAIL) return true
  if (plan === 'starter' || plan === 'pro' || plan === 'enterprise') return true
  if (plan === 'trial' && trialEndsAt) {
    return new Date(trialEndsAt) > new Date()
  }
  return false
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { customer_id, professional_id, service_id, starts_at, notes } = body

    if (!customer_id || !professional_id || !service_id || !starts_at) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    // Verificar se o plano está ativo
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, trial_ends_at')
      .eq('id', profile.org_id)
      .single()

    if (!org || !isPlanActive(org.plan, org.trial_ends_at, user.email || '')) {
      return NextResponse.json({
        error: 'Seu período gratuito expirou. Assine um plano para continuar criando agendamentos.',
        code: 'PLAN_EXPIRED'
      }, { status: 403 })
    }

    // Verificar limite de agendamentos do mês
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString()
    const monthEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)).toISOString()

    const { count: agendamentosNoMes } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .not('status', 'eq', 'cancelled')
      .gte('starts_at', monthStart)
      .lte('starts_at', monthEnd)

    const limites: Record<string, number> = {
      trial: 20, starter: 50, pro: 500, enterprise: 99999
    }

    // Verificar limites extras do banco
    const { data: orgExtra } = await supabase
      .from('organizations')
      .select('limite_agendamentos')
      .eq('id', profile.org_id)
      .single()

    const limiteBase = limites[org.plan] || 20
    const limiteExtra = orgExtra?.limite_agendamentos || 0
    const limiteTotal = limiteBase + limiteExtra

    if (user.email !== ADMIN_EMAIL && (agendamentosNoMes || 0) >= limiteTotal) {
      return NextResponse.json({
        error: `Limite de ${limiteTotal} agendamentos por mês atingido. Faça upgrade ou adquira um pacote extra.`,
        code: 'LIMIT_REACHED'
      }, { status: 403 })
    }

    const { data: service } = await supabase.from('services').select('duration_min').eq('id', service_id).single()
    if (!service) return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })

    const startsAt = new Date(starts_at)
    const endsAt = new Date(startsAt.getTime() + service.duration_min * 60000)

    const { data: conflict } = await supabase
      .from('appointments').select('id')
      .eq('professional_id', professional_id)
      .not('status', 'in', '(cancelled)')
      .lt('starts_at', endsAt.toISOString())
      .gt('ends_at', startsAt.toISOString())

    if (conflict && conflict.length > 0) {
      return NextResponse.json({ error: 'Horário já ocupado para este profissional' }, { status: 409 })
    }

    const { data: appt, error } = await supabase
      .from('appointments')
      .insert({
        org_id: profile.org_id, customer_id, professional_id, service_id,
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        status: 'confirmed', notes: notes || null,
      })
      .select().single()

    if (error || !appt) return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })

    let whatsappSent = false
    try {
      const adminSupabase = createAdminSupabaseClient()
      const [customerRes, professionalRes, serviceRes, orgRes] = await Promise.all([
        adminSupabase.from('customers').select('name, phone').eq('id', customer_id).single(),
        adminSupabase.from('professionals').select('name').eq('id', professional_id).single(),
        adminSupabase.from('services').select('name').eq('id', service_id).single(),
        adminSupabase.from('organizations').select('name, wapi_instance_id, wapi_token').eq('id', profile.org_id).single(),
      ])
      const message = buildMessage('confirmation', {
        customerName: customerRes.data?.name || 'Cliente',
        serviceName: serviceRes.data?.name || 'Serviço',
        professionalName: professionalRes.data?.name || 'Profissional',
        startsAt: startsAt.toISOString(),
        orgName: orgRes.data?.name || 'Nosso estabelecimento',
      })
      const phone = customerRes.data?.phone || ''
      whatsappSent = await sendWhatsAppMessage(phone, message, orgRes.data?.wapi_instance_id || undefined, orgRes.data?.wapi_token || undefined)
      await adminSupabase.from('messages_log').insert({
        org_id: profile.org_id, appointment_id: appt.id, type: 'confirmation',
        phone, message, status: whatsappSent ? 'sent' : 'failed', sent_at: whatsappSent ? new Date().toISOString() : null,
      })
      if (whatsappSent) await adminSupabase.from('appointments').update({ wa_confirmation_sent: true }).eq('id', appt.id)
    } catch (waErr) { console.error('[WhatsApp]', waErr) }

    return NextResponse.json({ success: true, appointment: appt, whatsapp_sent: whatsappSent })
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
    let query = supabase.from('appointments')
      .select('*, customer:customers(*), professional:professionals(*), service:services(*)')
      .order('starts_at')
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0)
      const end = new Date(date); end.setHours(23, 59, 59, 999)
      query = query.gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString())
    }
    if (professionalId) query = query.eq('professional_id', professionalId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ appointments: data })
  } catch (err) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
