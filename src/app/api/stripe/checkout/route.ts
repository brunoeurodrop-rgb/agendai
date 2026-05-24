import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-03-31.basil' as any,
})

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const adminSupabase = createAdminSupabaseClient()

    let userId: string
    let userEmail: string

    if (token) {
      const { data: { user }, error } = await adminSupabase.auth.getUser(token)
      if (error || !user) {
        return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
      }
      userId = user.id
      userEmail = user.email || ''
    } else {
      const supabase = createServerSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
      }
      userId = user.id
      userEmail = user.email || ''
    }

    const { priceId } = await req.json()
    if (!priceId) {
      return NextResponse.json({ error: 'priceId obrigatorio' }, { status: 400 })
    }

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('org_id, name')
      .eq('id', userId)
      .single()

    if (!profile) return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 404 })

    const { data: org } = await adminSupabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', profile.org_id)
      .single()

    let customerId = org?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        name: org?.name || profile.name,
        metadata: { org_id: profile.org_id, user_id: userId },
      })
      customerId = customer.id
      await adminSupabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', profile.org_id)
    }

    // Usar a URL do app configurada nas variáveis de ambiente
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vermillion-palmier-d545a3.netlify.app'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { org_id: profile.org_id },
      },
      success_url: `${baseUrl}/assinatura/sucesso`,
      cancel_url: `${baseUrl}/assinatura/cancelada`,
      metadata: { org_id: profile.org_id },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (err: any) {
    console.error('[Stripe Checkout] Erro:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
