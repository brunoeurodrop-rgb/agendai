import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server'
import { sendWhatsAppMessage, buildMessage } from '@/lib/whatsapp'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizePhone } from '@/lib/sanitize'

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

const VALID_TYPES = ['confirmation', 'reminder_24h', 'reminder_1h', 'cancellation', 'rescheduling']

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticação
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    // Rate limiting por usuário
    const { allowed } = rateLimit(`whatsapp:${user.id}`, LIMITS.whatsapp)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Limite de mensagens atingido. Tente novamente em 1 hora.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const appointmentId = sanitizeString(body.appointmentId || '', 36)
    const type = sanitizeString(body.type || '', 30)

    // Validar tipo de mensagem
    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Tipo de mensagem inválido' }, { status: 400 })
    }

    // Validar UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!appointmentId || !uuidRegex.test(appointmentId)) {
      return NextResponse.json({ error: 'ID de agendamento inválido' }, { status: 400 })
    }

    // Buscar perfil para validar org
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

    const adminSupabase = createAdminSupabaseClient()

    // Buscar agendamento e validar que pertence à org do usuário
    const { data: appt, error } = await adminSupabase
      .from('appointments')
      .select('*, customer:customers(*), professional:professionals(*), service:services(*), organization:organizations(*)')
      .eq('id', appointmentId)
      .eq('org_id', profile.org_id) // Garantir que pertence à org do usuário
      .single()

    if (error || !appt) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
    }

    const message = buildMessage(type, {
      customerName: appt.customer.name,
      serviceName: appt.service.name,
      professionalName: appt.professional.name,
      startsAt: appt.starts_at,
      orgName: appt.organization?.name || 'Nosso estabelecimento',
    })

    const phone = sanitizePhone(appt.customer.phone)
    if (!phone) return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })

    const sent = await sendWhatsAppMessage(
      phone,
      message,
      appt.organization?.wapi_instance_id,
      appt.organization?.wapi_token
    )

    await adminSupabase.from('messages_log').insert({
      org_id: appt.org_id,
      appointment_id: appointmentId,
      type,
      phone,
      message,
      status: sent ? 'sent' : 'failed',
      sent_at: sent ? new Date().toISOString() : null,
    })

    const flagMap: Record<string, string> = {
      confirmation: 'wa_confirmation_sent',
      reminder_24h: 'wa_reminder_24h_sent',
      reminder_1h:  'wa_reminder_1h_sent',
    }
    if (flagMap[type] && sent) {
      await adminSupabase.from('appointments').update({ [flagMap[type]]: true }).eq('id', appointmentId)
    }

    return NextResponse.json({ success: sent })
  } catch (err) {
    console.error('[API WhatsApp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
