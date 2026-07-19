import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TXq9q3NsfHF8KhTMJDkvNWw': 'starter',
  'price_1TXqA53NsfHF8KhTFHn3X7US': 'pro',
}

function getPeriodEnd(sub: any): string | null {
  const ts = sub.current_period_end
  if (!ts) return null
  return new Date(ts * 1000).toISOString()
}

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' as any })

    const body = await req.text()
    const sig = req.headers.get('stripe-signature')!
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

    let event: any
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    } catch (err: any) {
      console.error('[Webhook] Assinatura inválida:', err.message)
      return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
    }

    const supabase = createAdminSupabaseClient()
    console.log('[Webhook] Evento recebido:', event.type)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any
        const orgId = session.metadata?.org_id
        const subscriptionId = session.subscription
        if (!orgId) break

        let plan = 'starter'
        let periodEnd: string | null = null

        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
            const priceId = subscription.items.data[0]?.price.id
            plan = PRICE_TO_PLAN[priceId] || 'starter'
            periodEnd = getPeriodEnd(subscription)
          } catch (err) {
            console.error('[Webhook] Erro ao buscar assinatura:', err)
          }
        }

        await supabase.from('organizations').update({
          plan,
          stripe_subscription_id: subscriptionId,
          stripe_current_period_end: periodEnd,
        }).eq('id', orgId)

        console.log('[Webhook] Plano atualizado:', plan, 'vence:', periodEnd)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as any
        const orgId = sub.metadata?.org_id
        if (!orgId) break
        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] || 'starter'
        const active = ['active', 'trialing'].includes(sub.status)
        const periodEnd = getPeriodEnd(sub)

        await supabase.from('organizations').update({
          plan: active ? plan : 'trial',
          stripe_subscription_id: sub.id,
          stripe_current_period_end: periodEnd,
        }).eq('id', orgId)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        const orgId = sub.metadata?.org_id
        if (!orgId) break
        await supabase.from('organizations').update({
          plan: 'trial',
          stripe_current_period_end: null,
        }).eq('id', orgId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subId = invoice.subscription
        if (!subId) break
        const { data: org } = await supabase.from('organizations').select('id').eq('stripe_subscription_id', subId).single()
        if (org) await supabase.from('organizations').update({ plan: 'trial', stripe_current_period_end: null }).eq('id', org.id)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[API Webhook]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
