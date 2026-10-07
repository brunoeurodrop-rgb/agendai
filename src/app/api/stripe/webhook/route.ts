import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

const PRICE_TO_PLAN: Record<string, string> = {
  'price_1UNOdy3NsfHF8KhTDw0Ca7NN': 'starter',
  'price_1UNOeQ3NsfHF8KhT8AdSV2CN': 'pro',
}

const ADMIN_EMAIL = 'bkpimenta81@gmail.com'

function getPeriodEnd(sub: any): string | null {
  const ts = sub.current_period_end
    ?? sub.billing_cycle_anchor
    ?? null
  if (!ts) {
    console.log('[Webhook] getPeriodEnd - campos disponíveis:', Object.keys(sub))
    return null
  }
  return new Date(ts * 1000).toISOString()
}

async function getOrgId(supabase: any, subscriptionId: string, metadataOrgId?: string): Promise<string | null> {
  if (metadataOrgId) return metadataOrgId

  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_subscription_id', subscriptionId)
    .single()

  return data?.id || null
}

async function enviarNotificacoes(orgName: string, clientEmail: string, plano: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.log('[Webhook] RESEND_API_KEY não configurada — emails não enviados')
    return
  }

  const planoLabel = plano === 'pro' ? 'Pro' : 'Starter'
  const planoPreco = plano === 'pro' ? 'R$ 99,90/mês' : 'R$ 49,90/mês'

  // 1. Email para o admin
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
        subject: `🎉 Novo cliente assinou o plano ${planoLabel}!`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #7c3aed;">Novo cliente no Está Agendado!</h2>
            <p>Uma nova empresa acabou de assinar:</p>
            <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Empresa</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${orgName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">E-mail</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${clientEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Plano</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${planoLabel} — ${planoPreco}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Data</td>
                <td style="padding: 8px 0; font-weight: 600; font-size: 14px;">${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
              </tr>
            </table>
            <p style="color: #6b7280; font-size: 13px;">Acesse o painel admin para mais detalhes.</p>
          </div>
        `,
      }),
    })
    console.log('[Webhook] Email de notificação enviado para admin')
  } catch (err) {
    console.error('[Webhook] Erro ao enviar email para admin:', err)
  }

  // 2. Email de boas-vindas para o cliente
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Está Agendado <noreply@estaagendado.com.br>',
        to: [clientEmail],
        subject: `Bem-vindo ao Está Agendado! Seu plano ${planoLabel} está ativo 🎉`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #7c3aed;">Parabéns, ${orgName}! 🎉</h2>
            <p style="color: #374151;">Seu plano <strong>${planoLabel}</strong> está ativo e pronto para uso.</p>

            <div style="background: #f5f3ff; border-left: 4px solid #7c3aed; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #5b21b6; font-weight: 600;">Plano ${planoLabel} — ${planoPreco}</p>
              <p style="margin: 4px 0 0; color: #7c3aed; font-size: 13px;">Renovação automática mensal via cartão</p>
            </div>

            <h3 style="color: #1f2937; font-size: 16px;">Próximos passos:</h3>
            <ol style="color: #374151; padding-left: 20px; line-height: 1.8;">
              <li>Acesse <a href="https://estaagendado.com.br/login" style="color: #7c3aed;">estaagendado.com.br</a> e faça login</li>
              <li>Conecte seu WhatsApp em <strong>Configurações</strong></li>
              <li>Cadastre seus profissionais e serviços</li>
              <li>Comece a agendar!</li>
            </ol>

            <div style="margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 13px;">Precisa de ajuda? Fale com nosso suporte pelo WhatsApp:</p>
              <a href="https://wa.me/5521990760217" style="display: inline-block; margin-top: 8px; background: #22c55e; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
                Suporte via WhatsApp
              </a>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Está Agendado — Sistema de agendamento inteligente com WhatsApp<br>
              estaagendado.com.br
            </p>
          </div>
        `,
      }),
    })
    console.log('[Webhook] Email de boas-vindas enviado para cliente:', clientEmail)
  } catch (err) {
    console.error('[Webhook] Erro ao enviar email para cliente:', err)
  }
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
        if (!orgId || !subscriptionId) break

        let plan = 'starter'
        let periodEnd: string | null = null

        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any
          const priceId = subscription.items.data[0]?.price.id
          plan = PRICE_TO_PLAN[priceId] || 'starter'
          periodEnd = getPeriodEnd(subscription)

          await stripe.subscriptions.update(subscriptionId, {
            metadata: { org_id: orgId }
          })
        } catch (err) {
          console.error('[Webhook] Erro ao buscar/atualizar assinatura:', err)
        }

        await supabase.from('organizations').update({
          plan,
          stripe_subscription_id: subscriptionId,
          stripe_current_period_end: periodEnd,
        }).eq('id', orgId)

        console.log('[Webhook] Plano atualizado:', plan, 'vence:', periodEnd)

        // Buscar dados da org para enviar emails
        try {
          const { data: org } = await supabase
            .from('organizations')
            .select('name, profiles(email)')
            .eq('id', orgId)
            .single() as any

          if (org) {
            const clientEmail = session.customer_details?.email || org.profiles?.[0]?.email || ''
            const orgName = org.name || 'Cliente'
            if (clientEmail) {
              await enviarNotificacoes(orgName, clientEmail, plan)
            }
          }
        } catch (err) {
          console.error('[Webhook] Erro ao buscar org para notificação:', err)
        }

        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object as any
        const subscriptionId = sub.id

        const orgId = await getOrgId(supabase, subscriptionId, sub.metadata?.org_id)
        if (!orgId) {
          console.log('[Webhook] org_id não encontrado para subscription:', subscriptionId)
          break
        }

        const priceId = sub.items.data[0]?.price.id
        const plan = PRICE_TO_PLAN[priceId] || 'starter'
        const active = ['active', 'trialing'].includes(sub.status)
        const periodEnd = getPeriodEnd(sub)

        await supabase.from('organizations').update({
          plan: active ? plan : 'trial',
          stripe_subscription_id: subscriptionId,
          stripe_current_period_end: periodEnd,
        }).eq('id', orgId)

        console.log('[Webhook] Assinatura atualizada - org:', orgId, 'plano:', plan, 'vence:', periodEnd)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as any
        const orgId = await getOrgId(supabase, sub.id, sub.metadata?.org_id)
        if (!orgId) break

        await supabase.from('organizations').update({
          plan: 'trial',
          stripe_current_period_end: null,
        }).eq('id', orgId)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        const subId = invoice.subscription
        if (!subId) break

        try {
          const subscription = await stripe.subscriptions.retrieve(subId) as any
          const periodEnd = getPeriodEnd(subscription)
          const orgId = await getOrgId(supabase, subId, subscription.metadata?.org_id)
          if (!orgId) break

          await supabase.from('organizations').update({
            stripe_current_period_end: periodEnd,
          }).eq('id', orgId)

          console.log('[Webhook] Renovação - org:', orgId, 'novo vencimento:', periodEnd)
        } catch (err) {
          console.error('[Webhook] Erro ao processar renovação:', err)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subId = invoice.subscription
        if (!subId) break

        const orgId = await getOrgId(supabase, subId)
        if (orgId) {
          await supabase.from('organizations').update({
            plan: 'trial',
            stripe_current_period_end: null,
          }).eq('id', orgId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[API Webhook]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
