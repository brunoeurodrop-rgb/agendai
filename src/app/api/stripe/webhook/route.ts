import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-31.basil' as any })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('[Webhook] Assinatura inválida:', err.message)
    return NextResponse.json({ error: 'Webhook inválido' }, { status: 400 })
  }

  const supabase = createAdminSupabaseClient()

  const PRICE_TO_PLAN: Record<string, string> = {
    'price_1TXkT13NsfHF8KhTp2RB3osZ': 'starter',
    'price_1TXkTa3NsfHF8KhTQS7qO6xQ': 'pro',
    'price_1TXkTs3NsfHF8KhTDS9l0x7B': 'enterprise',
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as any
      const orgId = session.metadata?.org_id
      if (!orgId) break
      await supabase.from('organizations').update({
        plan: 'trial',
        stripe_subscription_id: session.subscription as string,
      }).eq('id', orgId)
      break
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as any
      const orgId = sub.metadata?.org_id
      if (!orgId) break
      const priceId = sub.items.data[0]?.price.id
      const plan = PRICE_TO_PLAN[priceId] || 'starter'
      const status = sub.status
      const active = ['active', 'trialing'].includes(status)
      await supabase.from('organizations').update({
        plan: active ? plan : 'trial',
        stripe_subscription_id: sub.id,
      }).eq('id', orgId)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const orgId = sub.metadata?.org_id
      if (!orgId) break
      await supabase.from('organizations').update({ plan: 'trial' }).eq('id', orgId)
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as any
      const subId = invoice.subscription as string
      if (!subId) break
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('stripe_subscription_id', subId)
        .single()
      if (org) {
        await supabase.from('organizations').update({ plan: 'trial' }).eq('id', org.id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
