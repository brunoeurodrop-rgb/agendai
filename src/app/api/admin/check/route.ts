import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
