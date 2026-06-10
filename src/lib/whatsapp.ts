export function buildMessage(type: string, data: {
  customerName: string
  serviceName: string
  professionalName: string
  startsAt: string
  orgName: string
}): string {
  const date = new Date(data.startsAt)
  const dateStr = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

  const templates: Record<string, string> = {
    confirmation: `Olá, ${data.customerName}! 😊\n\nSeu agendamento foi *confirmado*!\n\n📅 *Data:* ${dateStr}\n⏰ *Horário:* ${timeStr}\n✂️ *Serviço:* ${data.serviceName}\n👩 *Profissional:* ${data.professionalName}\n\nEstamos te esperando! ✨\n\n_${data.orgName}_`,
    reminder_24h: `Olá, ${data.customerName}! 🔔\n\nLembrete: seu horário é *amanhã*!\n\n⏰ *${timeStr}* — ${data.serviceName} com ${data.professionalName}\n\nDeseja confirmar presença? Responda *SIM* para confirmar ou *NÃO* para cancelar.\n\n_${data.orgName}_`,
    reminder_1h:  `Olá, ${data.customerName}! ⏰\n\nSeu horário começa em *1 hora* — às ${timeStr}!\n\n✂️ ${data.serviceName} com ${data.professionalName}\n\nTe esperamos em breve! 💚\n\n_${data.orgName}_`,
    cancellation: `Olá, ${data.customerName}.\n\nInformamos que seu agendamento de *${data.serviceName}* em ${dateStr} às ${timeStr} foi *cancelado*.\n\nPara reagendar, entre em contato conosco.\n\n_${data.orgName}_`,
    rescheduling: `Olá, ${data.customerName}! 📅\n\nSeu agendamento foi *reagendado*.\n\n📅 *Nova data:* ${dateStr}\n⏰ *Novo horário:* ${timeStr}\n✂️ *Serviço:* ${data.serviceName}\n\nQualquer dúvida, estamos à disposição!\n\n_${data.orgName}_`,
  }

  return templates[type] || templates.confirmation
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  const instanceId = process.env.WAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE_ID
  const token = process.env.WAPI_TOKEN || process.env.ZAPI_TOKEN
  const provider = process.env.WAPI_INSTANCE_ID ? 'wapi' : 'zapi'

  if (!instanceId || !token) {
    console.log(`[WhatsApp SIMULADO] Para: ${phone}\n${message}`)
    return true
  }

  try {
    let number = phone.replace(/\D/g, '')
    if (!number.startsWith('55')) number = '55' + number

    let url: string
    let headers: Record<string, string>
    let body: object

    if (provider === 'wapi') {
      // W-API endpoint
      url = `https://api.w-api.app/v1/message/send-text?instanceId=${instanceId}`
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      }
      body = {
        phone: number,
        message: message,
      }
    } else {
      // Z-API endpoint (fallback)
      const clientToken = process.env.ZAPI_CLIENT_TOKEN
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
      headers = {
        'Content-Type': 'application/json',
        ...(clientToken ? { 'Client-Token': clientToken } : {}),
      }
      body = { phone: number, message }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    const data = await res.json()
    console.log(`[WhatsApp ${provider.toUpperCase()}] Resposta:`, JSON.stringify(data))
    return res.ok && !data.error
  } catch (err) {
    console.error('[WhatsApp] Erro ao enviar:', err)
    return false
  }
}
