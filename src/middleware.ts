import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PUBLIC_ROUTES = ['/login', '/api/stripe/webhook']
const BLOCKED_REDIRECT = '/planos'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rotas públicas passam direto
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  // Rotas de API passam direto (exceto as protegidas)
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) { return req.cookies.get(name)?.value },
        set(name, value, options) { res.cookies.set({ name, value, ...options }) },
        remove(name, options) { res.cookies.set({ name, value: '', ...options }) },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // Não logado — vai para login
  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Logado — verificar status da conta
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', session.user.id)
      .single()

    if (profile) {
      const { data: org } = await supabase
        .from('organizations')
        .select('plan, trial_ends_at')
        .eq('id', profile.org_id)
        .single()

      if (org) {
        const now = new Date()
        const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null
        const trialExpired = trialEnd ? now > trialEnd : false
        const isBlocked = org.plan === 'trial' && trialExpired

        // Se bloqueado e não está na página de planos, redireciona
        if (isBlocked && pathname !== BLOCKED_REDIRECT) {
          return NextResponse.redirect(new URL(BLOCKED_REDIRECT, req.url))
        }
      }
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
