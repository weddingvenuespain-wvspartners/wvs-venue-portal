import { NextRequest, NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'
import { buildRedirectFormData, generateOrderNumber } from '@/lib/redsys'
import type { BillingCycle } from '@/lib/billing-types'

// POST /api/redsys/create-payment
// Body: { planId: string, cycleId: string }
// Returns the form fields to POST to Redsys redirect endpoint.

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { planId, cycleId } = await req.json()
    if (!planId || !cycleId) {
      return NextResponse.json({ error: 'planId y cycleId requeridos' }, { status: 400 })
    }

    // Use service client to bypass RLS on venue_plans
    const supabase = getServiceClient()
    const { data: plan, error: planError } = await supabase
      .from('venue_plans')
      .select('id, name, display_name, billing_cycles, is_active')
      .eq('id', planId)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    if (!plan.is_active) {
      return NextResponse.json({ error: 'Plan no disponible' }, { status: 400 })
    }

    // Find the billing cycle by id
    const cycles = (plan.billing_cycles || []) as BillingCycle[]
    const cycle = cycles.find(c => c.id === cycleId)
    if (!cycle || cycle.price <= 0) {
      return NextResponse.json({ error: 'Ciclo de facturación no encontrado' }, { status: 400 })
    }

    const amountCents = Math.round(cycle.price * 100)
    const order = generateOrderNumber()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Merchant data: encode userId + plan + cycle so webhook can process it
    const merchantData = JSON.stringify({
      userId: session.user.id,
      planId: plan.id,
      cycleId: cycle.id,
      intervalMonths: cycle.interval_months,
    })

    const formData = buildRedirectFormData({
      amountCents,
      order,
      notificationUrl: `${origin}/api/redsys/notification`,
      successUrl:      `${origin}/checkout/success?order=${order}`,
      errorUrl:        `${origin}/checkout/error?order=${order}`,
      merchantData,
      language:        '1', // Spanish
      requestToken:    true, // Request tokenization for recurring charges
    })

    return NextResponse.json({
      success: true,
      formData,
      plan: {
        name: plan.display_name || plan.name,
        price: cycle.price,
        cycleLabel: cycle.label,
      },
    })
  } catch (err: any) {
    console.error('[/api/redsys/create-payment]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
