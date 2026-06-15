import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { syncPlanToStripe } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── POST /api/stripe/sync-plan ──────────────────────────────────────────────
// Admin-only. Syncs a venue_plan to Stripe Products + Prices.
// Body: { planId }
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

    // Check admin
    const svc = getServiceClient()
    const { data: profile } = await svc
      .from('venue_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 })
    }

    const { planId } = await req.json()
    if (!planId) return NextResponse.json({ error: 'planId requerido' }, { status: 400 })

    const { data: plan } = await svc
      .from('venue_plans')
      .select('*')
      .eq('id', planId)
      .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    const result = await syncPlanToStripe({
      id: plan.id,
      name: plan.name,
      display_name: plan.display_name,
      billing_cycles: plan.billing_cycles || [],
      is_active: plan.is_active,
      stripe_product_id: plan.stripe_product_id,
      stripe_price_ids: plan.stripe_price_ids,
    })

    return NextResponse.json({
      success: true,
      stripe_product_id: result.stripe_product_id,
      stripe_price_ids: result.stripe_price_ids,
    })
  } catch (err: any) {
    console.error('[stripe/sync-plan]', err)
    return NextResponse.json({ error: err.message || 'Error al sincronizar plan' }, { status: 500 })
  }
}
