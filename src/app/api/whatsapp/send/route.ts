import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { sendWhatsAppMessage, buildMessage } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { appointmentId, type, phone: directPhone, message: directMessage } = await req.json()

    if (directPhone && directMessage) {
      const sent = await sendWhatsAppMessage(directPhone, directMessage)
      return NextResponse.json({ success: sent })
    }

    if (!appointmentId || !type) {
      return NextResponse.json({ error: 'appointmentId e type são obrigatórios' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const { data: appt, error } = await supabase
      .from('appointments')
      .select('*, customer:customers(*), professional:professionals(*), service:services(*), organization:organizations(*)')
      .eq('id', appointmentId)
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

    const phone = appt.customer.phone
    const sent = await sendWhatsAppMessage(phone, message)

    await supabase.from('messages_log').insert({
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
      await supabase.from('appointments').update({ [flagMap[type]]: true }).eq('id', appointmentId)
    }

    return NextResponse.json({ success: sent })
  } catch (err) {
    console.error('[API WhatsApp]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
