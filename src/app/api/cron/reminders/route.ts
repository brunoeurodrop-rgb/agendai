import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { sendWhatsAppMessage, buildMessage } from '@/lib/whatsapp'

// Protege a rota para só ser chamada pelo serviço de cron autorizado
function isAuthorized(req: NextRequest): boolean {
  const secret = req.nextUrl.searchParams.get('secret') || req.headers.get('x-cron-secret')
  return secret === process.env.CRON_SECRET
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminSupabaseClient()
  const now = new Date()

  const results = { reminder_24h: 0, reminder_1h: 0, errors: 0 }

  try {
    // ===== LEMBRETE 24H ANTES =====
    // Janela: agendamentos entre 23h45 e 24h15 a partir de agora
    const window24Start = new Date(now.getTime() + 23.75 * 60 * 60 * 1000)
    const window24End = new Date(now.getTime() + 24.25 * 60 * 60 * 1000)

    const { data: appts24h } = await supabase
      .from('appointments')
      .select('*, customer:customers(name, phone), professional:professionals(name), service:services(name), organization:organizations(name, wapi_instance_id, wapi_token)')
      .eq('status', 'confirmed')
      .eq('wa_reminder_24h_sent', false)
      .gte('starts_at', window24Start.toISOString())
      .lte('starts_at', window24End.toISOString())

    for (const appt of appts24h || []) {
      try {
        const message = buildMessage('reminder_24h', {
          customerName: (appt.customer as any)?.name || 'Cliente',
          serviceName: (appt.service as any)?.name || 'Serviço',
          professionalName: (appt.professional as any)?.name || 'Profissional',
          startsAt: appt.starts_at,
          orgName: (appt.organization as any)?.name || 'Nosso estabelecimento',
        })
        const phone = (appt.customer as any)?.phone || ''
        const org = appt.organization as any
        const sent = await sendWhatsAppMessage(phone, message, org?.wapi_instance_id, org?.wapi_token)

        await supabase.from('messages_log').insert({
          org_id: appt.org_id, appointment_id: appt.id, type: 'reminder_24h',
          phone, message, status: sent ? 'sent' : 'failed', sent_at: sent ? new Date().toISOString() : null,
        })

        if (sent) {
          await supabase.from('appointments').update({ wa_reminder_24h_sent: true }).eq('id', appt.id)
          results.reminder_24h++
        } else {
          results.errors++
        }
      } catch (err) {
        console.error('[Cron 24h] Erro no agendamento', appt.id, err)
        results.errors++
      }
    }

    // ===== LEMBRETE 1H ANTES =====
    const window1Start = new Date(now.getTime() + 0.75 * 60 * 60 * 1000)
    const window1End = new Date(now.getTime() + 1.25 * 60 * 60 * 1000)

    const { data: appts1h } = await supabase
      .from('appointments')
      .select('*, customer:customers(name, phone), professional:professionals(name), service:services(name), organization:organizations(name, wapi_instance_id, wapi_token)')
      .eq('status', 'confirmed')
      .eq('wa_reminder_1h_sent', false)
      .gte('starts_at', window1Start.toISOString())
      .lte('starts_at', window1End.toISOString())

    for (const appt of appts1h || []) {
      try {
        const message = buildMessage('reminder_1h', {
          customerName: (appt.customer as any)?.name || 'Cliente',
          serviceName: (appt.service as any)?.name || 'Serviço',
          professionalName: (appt.professional as any)?.name || 'Profissional',
          startsAt: appt.starts_at,
          orgName: (appt.organization as any)?.name || 'Nosso estabelecimento',
        })
        const phone = (appt.customer as any)?.phone || ''
        const org = appt.organization as any
        const sent = await sendWhatsAppMessage(phone, message, org?.wapi_instance_id, org?.wapi_token)

        await supabase.from('messages_log').insert({
          org_id: appt.org_id, appointment_id: appt.id, type: 'reminder_1h',
          phone, message, status: sent ? 'sent' : 'failed', sent_at: sent ? new Date().toISOString() : null,
        })

        if (sent) {
          await supabase.from('appointments').update({ wa_reminder_1h_sent: true }).eq('id', appt.id)
          results.reminder_1h++
        } else {
          results.errors++
        }
      } catch (err) {
        console.error('[Cron 1h] Erro no agendamento', appt.id, err)
        results.errors++
      }
    }

    console.log('[Cron Reminders] Resultado:', results)
    return NextResponse.json({ success: true, ...results, executed_at: now.toISOString() })
  } catch (err) {
    console.error('[Cron Reminders] Erro geral:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
