import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getStripe, syncPlanToStripe } from '@/lib/stripe'
import { sendPlanChangeEmail } from '@/lib/mailer'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── POST /api/stripe/upgrade ─────────────────────────────────────────────────
// Upgrades or downgrades an existing Stripe subscription to a new plan/cycle.
// Uses Stripe proration to handle billing adjustments.
// Body: { planId, cycleId }
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { planId, cycleId } = await req.json()
    if (!planId || !cycleId) return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })

    const svc = getServiceClient()

    // Get user's active subscription with Stripe info
    const { data: sub } = await svc
      .from('venue_subscriptions')
      .select('id, plan_id, stripe_subscription_id, stripe_customer_id, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!sub?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No tienes una suscripción activa en Stripe para cambiar de plan' }, { status: 400 })
    }

    // Fetch new plan
    const { data: newPlan } = await svc
      .from('venue_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()
    if (!newPlan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    // Find cycle + stripe price
    const cycles = newPlan.billing_cycles as any[]
    const cycle = cycles?.find((c: any) => c.id === cycleId)
    if (!cycle) return NextResponse.json({ error: 'Ciclo de facturación no encontrado' }, { status: 404 })

    // Auto-sync plan to Stripe if not synced
    let priceIds = newPlan.stripe_price_ids as Record<string, string> | null
    let priceId = priceIds?.[cycleId]
    if (!priceId) {
      const synced = await syncPlanToStripe({
        id: newPlan.id,
        name: newPlan.name,
        display_name: newPlan.display_name,
        billing_cycles: newPlan.billing_cycles || [],
        is_active: newPlan.is_active,
        stripe_product_id: newPlan.stripe_product_id,
        stripe_price_ids: newPlan.stripe_price_ids,
      })
      priceIds = synced.stripe_price_ids
      priceId = priceIds?.[cycleId]
    }
    if (!priceId) {
      return NextResponse.json({ error: 'No se pudo obtener el precio en Stripe' }, { status: 500 })
    }

    const stripe = getStripe()

    // Get current Stripe subscription to find the item to replace
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id)
    const currentItem = stripeSub.items.data[0]
    if (!currentItem) {
      return NextResponse.json({ error: 'Suscripción de Stripe no tiene items' }, { status: 500 })
    }

    // Update subscription with proration
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{
        id: currentItem.id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations', // Stripe calculates credit/debit automatically
      metadata: {
        ...stripeSub.metadata,
        plan_id: planId,
        cycle_id: cycleId,
        upgraded_at: new Date().toISOString(),
      },
    })

    // Update local subscription record
    await svc
      .from('venue_subscriptions')
      .update({
        previous_plan_id: sub.plan_id,
        plan_id: planId,
        changed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id)

    // Log in plan history (best-effort)
    try {
      await svc.from('venue_plan_history').insert({
        plan_id: planId,
        changed_by: user.id,
        action: 'upgraded',
        changes: {
          previous_plan_id: sub.plan_id,
          new_plan_id: planId,
          cycle_id: cycleId,
          stripe_subscription_id: sub.stripe_subscription_id,
        },
      })
    } catch {} // don't fail if history table doesn't exist yet

    // Send plan change email (best-effort)
    try {
      const { data: profile } = await svc.from('venue_profiles').select('email, display_name, company').eq('user_id', user.id).single()
      const { data: oldPlan } = await svc.from('venue_plans').select('display_name, name, sort_order').eq('id', sub.plan_id).single()
      if (profile?.email && oldPlan) {
        const isUpgrade = (newPlan.sort_order ?? 0) > (oldPlan.sort_order ?? 0)
        await sendPlanChangeEmail({
          to: profile.email,
          venueName: profile.company || profile.display_name || '',
          oldPlanName: oldPlan.display_name || oldPlan.name,
          newPlanName: newPlan.display_name || newPlan.name,
          amount: cycle.price || 0,
          intervalLabel: cycle.label?.toLowerCase() || 'año',
          isUpgrade,
        })
      }
    } catch (emailErr) { console.error('[stripe/upgrade] Plan change email failed:', emailErr) }

    return NextResponse.json({
      success: true,
      subscription_id: updated.id,
      current_period_end: (updated as any).current_period_end,
    })
  } catch (err: any) {
    console.error('[stripe/upgrade]', err)
    return NextResponse.json({ error: err.message || 'Error al cambiar de plan' }, { status: 500 })
  }
}
