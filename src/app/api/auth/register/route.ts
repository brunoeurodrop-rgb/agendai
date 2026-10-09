import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizeEmail } from '@/lib/sanitize'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

async function enviarEmailsCadastro(name: string, email: string, company: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log('[Register] RESEND_API_KEY não configurada — emails não enviados')
    return
  }

  const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  // 1. Notificação para o admin
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Está Agendado <noreply@estaagendado.com.br>',
        to: [ADMIN_EMAIL],
        subject: `🆕 Novo cadastro: ${company}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#009E76;margin-bottom:4px;">Novo cadastro no Está Agendado!</h2>
            <p style="color:#6b7280;font-size:14px;margin-top:0;">Trial de 14 dias iniciado</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;width:120px;">Empresa</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${company}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Responsável</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${name}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">E-mail</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${email}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;font-size:14px;">Data/hora</td><td style="padding:8px 0;font-weight:600;font-size:14px;">${dataHora}</td></tr>
            </table>
          </div>
        `,
      }),
    })
    console.log('[Register] Email de notificação enviado para admin')
  } catch (err) {
    console.error('[Register] Erro ao notificar admin:', err)
  }

  // 2. Boas-vindas para o cliente
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Está Agendado <noreply@estaagendado.com.br>',
        to: [email],
        subject: `Bem-vindo ao Está Agendado, ${name}! Seu trial começa agora 🎉`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
            <h2 style="color:#009E76;">Olá, ${name}! Bem-vindo ao Está Agendado 👋</h2>
            <p style="color:#374151;">Sua conta foi criada com sucesso. Você tem <strong>14 dias grátis</strong> para explorar todos os recursos.</p>
            <div style="background:#E0FFF6;border-left:4px solid #009E76;padding:16px;border-radius:8px;margin:20px 0;">
              <p style="margin:0;color:#007a5a;font-weight:600;">Por onde começar:</p>
              <ol style="color:#374151;padding-left:20px;line-height:2;margin:8px 0 0;">
                <li>Acesse <a href="https://estaagendado.com.br/login" style="color:#009E76;">estaagendado.com.br</a> e faça login</li>
                <li>Cadastre seus serviços e profissionais</li>
                <li>Conecte seu WhatsApp em <strong>Configurações</strong></li>
                <li>Faça seu primeiro agendamento!</li>
              </ol>
            </div>
            <p style="color:#374151;">Qualquer dúvida, fale com a gente pelo WhatsApp:</p>
            <a href="https://wa.me/5521990760217" style="display:inline-block;background:#009E76;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">Suporte via WhatsApp</a>
            <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Está Agendado — Sistema de agendamento com WhatsApp<br>estaagendado.com.br</p>
          </div>
        `,
      }),
    })
    console.log('[Register] Email de boas-vindas enviado para:', email)
  } catch (err) {
    console.error('[Register] Erro ao enviar boas-vindas:', err)
  }
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting — máximo 10 registros por hora por IP
    const ip = getClientIP(req)
    const { allowed } = rateLimit(`register:${ip}`, LIMITS.auth)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
        { status: 429 }
      )
    }

    const body = await req.json()

    // Sanitizar inputs
    const name = sanitizeString(body.name, 100)
    const email = sanitizeEmail(body.email)
    const password = sanitizeString(body.password, 100)
    const company = sanitizeString(body.company, 200)

    if (!name || !email || !password || !company) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'EMAIL_EXISTS' }, { status: 409 })
      }
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
    }

    const userId = authData.user.id
    const slug = `org-${userId.slice(0, 8)}`

    // Calcular data de expiração do trial (14 dias)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: company,
        slug,
        plan: 'trial',
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single()

    if (orgError || !org) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 })
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      org_id: org.id,
      email,
      name,
      role: 'owner',
    })

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Erro ao configurar perfil' }, { status: 500 })
    }

    // Enviar e-mails de cadastro (não bloqueia o retorno)
    enviarEmailsCadastro(name, email, company).catch(err =>
      console.error('[Register] Falha nos emails:', err)
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Register]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
