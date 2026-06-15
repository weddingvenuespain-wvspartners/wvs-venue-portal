import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getStripe, getOrCreateCustomer, syncPlanToStripe } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── POST /api/stripe/billing-checkout ────────────────────────────────────────
// Creates a Stripe Checkout Session for a venue SUBSCRIPTION (Stripe Billing).
// Body: { planId, cycleId, venueId? }
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

    const { planId, cycleId, venueId } = await req.json()
    if (!planId || !cycleId) return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })

    const svc = getServiceClient()

    // Fetch plan
    const { data: plan } = await svc
      .from('venue_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()
    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    // Find cycle + stripe price
    const cycles = plan.billing_cycles as any[]
    const cycle = cycles?.find((c: any) => c.id === cycleId)
    if (!cycle) return NextResponse.json({ error: 'Ciclo de facturación no encontrado' }, { status: 404 })

    // Auto-sync plan to Stripe if not synced yet
    let priceIds = plan.stripe_price_ids as Record<string, string> | null
    let priceId = priceIds?.[cycleId]
    if (!priceId) {
      console.log(`[billing-checkout] Auto-syncing plan ${planId} to Stripe...`)
      const synced = await syncPlanToStripe({
        id: plan.id,
        name: plan.name,
        display_name: plan.display_name,
        billing_cycles: plan.billing_cycles || [],
        is_active: plan.is_active,
        stripe_product_id: plan.stripe_product_id,
        stripe_price_ids: plan.stripe_price_ids,
      })
      priceIds = synced.stripe_price_ids
      priceId = priceIds?.[cycleId]
    }
    if (!priceId) {
      return NextResponse.json({
        error: 'No se pudo crear el precio en Stripe. Contacta con soporte.',
      }, { status: 500 })
    }

    // Get or create Stripe Customer
    const { data: profile } = await svc
      .from('venue_profiles')
      .select('display_name, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const customerName = profile?.display_name
      || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
      || null
    const customerId = await getOrCreateCustomer(user.id, user.email!, customerName)

    // Build Checkout Session
    const stripe = getStripe()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin

    const sessionParams: any = {
      customer: customerId,
      customer_email: undefined, // use customer object (email already set there)
      customer_update: { name: 'auto', address: 'auto', shipping: 'auto' },
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/pricing`,
      // Collect full billing info (name, address, tax ID)
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      // Locale & branding
      locale: 'es',
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: planId,
          cycle_id: cycleId,
          venue_id: venueId || '',
        },
      },
      metadata: {
        type: 'venue_subscription',
        user_id: user.id,
        plan_id: planId,
        cycle_id: cycleId,
        venue_id: venueId || '',
      },
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message: 'Al contratar aceptas los términos de servicio de FOREVENTOS. Tu suscripción se renovará automáticamente. Puedes cancelarla desde tu perfil.',
        },
      },
    }

    // Trial if plan has trial_days and user hasn't trialed before
    if (plan.trial_days && plan.trial_days > 0) {
      const { count } = await svc
        .from('venue_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('status', ['active', 'trial_expired', 'cancelled'])

      // Only give trial to truly new users
      if (!count || count === 0) {
        sessionParams.subscription_data.trial_period_days = plan.trial_days
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[stripe/billing-checkout]', err)
    return NextResponse.json({ error: err.message || 'Error al crear checkout' }, { status: 500 })
  }
}
