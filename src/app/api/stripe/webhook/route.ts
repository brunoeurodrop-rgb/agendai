import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1TXq9q3NsfHF8KhTMJDkvNWw': 'starter',
  'price_1TXqA53NsfHF8KhTFHn3X7US': 'pro',
  'price_1TXqAP3NsfHF8KhTgB4woG5a': 'enterprise',
}

export async function POST(req: NextRequest) {
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-03-31.basil' as any,
    })

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
        const session = event.data.object
        const orgId = session.metadata?.org_id
        const subscriptionId = session.subscription

        console.log('[Webhook] checkout.session.completed - org_id:', orgId, 'subscription:', subscriptionId)

        if (!orgId) {
          console.error('[Webhook] org_id não encontrado no metadata')
          break
        }

        // Buscar o plano da assinatura
        let plan = 'starter'
        if (subscriptionId) {
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            const priceId = subscription.items.data[0]?.price.id
            plan = PRICE_TO_PLAN[priceId] || 'starter'
            console.log('[Webhook] Plano identificado:', plan, 'priceId:', priceId)
          } catch (err) {
            console.error('[Webhook] Erro ao buscar assinatura:', err)
          }
        }

        const { error } = await supabase.from('organizations').update({
          plan,
          stripe_subscription_id: subscriptionId,
        }).eq('id', orgId)

        if (error) {
          console.error('[Webhook] Erro ao atualizar org:', error)
        } else {
          console.log('[Webhook] Plano atualizado para:', plan, 'org:', orgId)
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object
        const orgId = sub.metadata?.org_id
        console.log('[Webhook]', event.type, '- org_id:', orgId)
        if (!orgId) break
        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] || 'starter'
        const active = ['active', 'trialing'].includes(sub.status)
        await supabase.from('organizations').update({
          plan: active ? plan : 'trial',
          stripe_subscription_id: sub.id,
        }).eq('id', orgId)
        console.log('[Webhook] Assinatura atualizada - plano:', plan, 'status:', sub.status)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const orgId = sub.metadata?.org_id
        if (!orgId) break
        await supabase.from('organizations').update({ plan: 'trial' }).eq('id', orgId)
        console.log('[Webhook] Assinatura cancelada - org:', orgId)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId = invoice.subscription
        if (!subId) break
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_subscription_id', subId)
          .single()
        if (org) {
          await supabase.from('organizations').update({ plan: 'trial' }).eq('id', org.id)
          console.log('[Webhook] Pagamento falhou - org:', org.id)
        }
        break
      }

      default:
        console.log('[Webhook] Evento não tratado:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[API Webhook]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
