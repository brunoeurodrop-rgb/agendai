import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { sanitizeString, sanitizeEmail } from '@/lib/sanitize'

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

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[Register]', err)
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 })
  }
}
