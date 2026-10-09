import type { Config } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_KEY = process.env.RESEND_API_KEY!
const SUPORTE_URL = 'https://wa.me/5521990760217'
const APP_URL = 'https://estaagendado.com.br'

async function enviarEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Está Agendado <noreply@estaagendado.com.br>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

function emailDia3(name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#009E76;">Olá, ${name}! Como está indo? 👋</h2>
      <p style="color:#374151;">Você já tem 3 dias de Está Agendado. Queria saber se está conseguindo usar tudo direitinho.</p>
      <p style="color:#374151;">Se tiver alguma dúvida ou travado em algum ponto, é só chamar — estamos aqui para ajudar.</p>
      <a href="${SUPORTE_URL}" style="display:inline-block;background:#009E76;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:8px;">Falar com o suporte</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — estaagendado.com.br</p>
    </div>
  `
}

function emailDia7(name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#009E76;">Uma semana de Está Agendado, ${name}! 🗓️</h2>
      <p style="color:#374151;">Você está na metade do seu período gratuito. Esperamos que já esteja sentindo como o sistema pode facilitar sua rotina.</p>
      <div style="background:#E0FFF6;border-left:4px solid #009E76;padding:16px;border-radius:8px;margin:20px 0;">
        <p style="margin:0;color:#007a5a;font-weight:600;">Dica: já testou os lembretes automáticos via WhatsApp?</p>
        <p style="margin:8px 0 0;color:#374151;font-size:14px;">Eles avisam o cliente automaticamente antes do agendamento — reduz faltas e economiza tempo.</p>
      </div>
      <a href="${APP_URL}/login" style="display:inline-block;background:#009E76;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Acessar o sistema</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — estaagendado.com.br</p>
    </div>
  `
}

function emailDia11(name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#009E76;">Seu trial termina em 3 dias, ${name} ⏳</h2>
      <p style="color:#374151;">Aproveite os últimos dias para explorar tudo. Quando o trial acabar, seus dados ficam seguros e você escolhe o plano que melhor atende seu negócio.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;font-weight:700;color:#111827;">Starter</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#009E76;">R$ 49,90<span style="font-size:14px;font-weight:400;color:#6b7280;">/mês</span></p>
            <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Ideal para autônomos e pequenos negócios</p>
          </td>
          <td style="padding:16px;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;font-weight:700;color:#111827;">Pro</p>
            <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#009E76;">R$ 99,90<span style="font-size:14px;font-weight:400;color:#6b7280;">/mês</span></p>
            <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Para equipes com múltiplos profissionais</p>
          </td>
        </tr>
      </table>
      <a href="${APP_URL}/planos" style="display:inline-block;background:#009E76;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Ver planos</a>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — estaagendado.com.br</p>
    </div>
  `
}

function emailDia13(name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#e97316;">Seu trial termina amanhã, ${name} 🔔</h2>
      <p style="color:#374151;">Para continuar usando o Está Agendado sem interrupção, escolha seu plano hoje.</p>
      <a href="${APP_URL}/planos" style="display:inline-block;background:#009E76;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px;">Escolher meu plano agora</a>
      <p style="color:#6b7280;font-size:13px;margin-top:20px;">Dúvidas? Fale com a gente pelo <a href="${SUPORTE_URL}" style="color:#009E76;">WhatsApp</a>.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — estaagendado.com.br</p>
    </div>
  `
}

function emailDia14(name: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="color:#111827;">Seu período gratuito terminou, ${name}</h2>
      <p style="color:#374151;">Seus dados estão seguros. Para continuar usando o sistema, escolha um dos planos abaixo:</p>
      <a href="${APP_URL}/planos" style="display:inline-block;background:#009E76;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px;">Ver planos e assinar</a>
      <p style="color:#6b7280;font-size:13px;margin-top:20px;">Precisa de ajuda para decidir? Fale com a gente pelo <a href="${SUPORTE_URL}" style="color:#009E76;">WhatsApp</a>.</p>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — estaagendado.com.br</p>
    </div>
  `
}

export default async function handler() {
  if (!RESEND_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[TrialEmails] Variáveis de ambiente faltando')
    return new Response('Configuração incompleta', { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  // Buscar todas as orgs em trial com dados do responsável
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name, trial_ends_at, profiles(name, email)')
    .eq('plan', 'trial')
    .not('trial_ends_at', 'is', null)

  if (error) {
    console.error('[TrialEmails] Erro ao buscar orgs:', error)
    return new Response('Erro ao buscar organizações', { status: 500 })
  }

  let enviados = 0
  let erros = 0

  for (const org of orgs ?? []) {
    const profile = (org.profiles as any)?.[0]
    if (!profile?.email || !profile?.name) continue

    const trialEnd = new Date(org.trial_ends_at)
    trialEnd.setHours(0, 0, 0, 0)

    const diffMs = trialEnd.getTime() - hoje.getTime()
    const diasRestantes = Math.round(diffMs / (1000 * 60 * 60 * 24))

    // Calcular dia do trial (14 - diasRestantes)
    const diaTrial = 14 - diasRestantes

    let subject = ''
    let html = ''

    if (diaTrial === 3) {
      subject = `Como está indo, ${profile.name}?`
      html = emailDia3(profile.name)
    } else if (diaTrial === 7) {
      subject = `Uma semana de Está Agendado! 🗓️`
      html = emailDia7(profile.name)
    } else if (diasRestantes === 3) {
      subject = `Seu trial termina em 3 dias ⏳`
      html = emailDia11(profile.name)
    } else if (diasRestantes === 1) {
      subject = `Seu trial termina amanhã 🔔`
      html = emailDia13(profile.name)
    } else if (diasRestantes === 0) {
      subject = `Seu período gratuito terminou`
      html = emailDia14(profile.name)
    } else {
      continue
    }

    try {
      await enviarEmail(profile.email, subject, html)
      console.log(`[TrialEmails] Enviado dia ${diaTrial} para ${profile.email}`)
      enviados++

      // Notificar admin no dia 14 (trial expirado)
      if (diasRestantes === 0) {
        await enviarEmail(
          ADMIN_EMAIL,
          `⏰ Trial expirado: ${org.name}`,
          `<div style="font-family:sans-serif;padding:24px;"><p>O trial de <strong>${org.name}</strong> (${profile.email}) expirou hoje.</p></div>`
        )
      }
    } catch (err) {
      console.error(`[TrialEmails] Erro ao enviar para ${profile.email}:`, err)
      erros++
    }
  }

  console.log(`[TrialEmails] Concluído — enviados: ${enviados}, erros: ${erros}`)
  return new Response(JSON.stringify({ enviados, erros }), { status: 200 })
}

export const config: Config = {
  schedule: '0 11 * * *', // 8h horário de Brasília (UTC-3)
}
