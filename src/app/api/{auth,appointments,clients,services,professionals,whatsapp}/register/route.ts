import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, company } = await req.json()

    if (!name || !email || !password || !company) {
      return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()

    // Criar usuário com confirmação automática
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

    // Criar organização
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: company, slug, plan: 'trial' })
      .select()
      .single()

    if (orgError || !org) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Erro ao criar empresa' }, { status: 500 })
    }

    // Criar perfil
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
