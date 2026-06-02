// POST /api/stripe/create-checkout
// Creates a Stripe Checkout Session for a budget installment payment.
// Public endpoint (no auth) — couples access this from the budget public page.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe, calculateCheckoutAmounts } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const { slug, installmentIndex, payAll, customAmount } = await req.json()
    if (!slug || (installmentIndex == null && !payAll)) {
      return NextResponse.json({ error: 'slug e installmentIndex (o payAll) requeridos' }, { status: 400 })
    }

    const svc = getServiceClient()
    const stripe = getStripe()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Fetch budget
    const { data: budget, error: budgetError } = await svc
      .from('budgets')
      .select('id, user_id, venue_id, slug, couple_name, payment_plan, total_amount, status')
      .eq('slug', slug)
      .single()

    if (budgetError || !budget) {
      return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })
    }

    if (budget.status === 'expired') {
      return NextResponse.json({ error: 'Presupuesto expirado' }, { status: 400 })
    }

    const plan = (budget.payment_plan || []) as any[]

    // Check venue has Stripe connected
    const { data: stripeAccount } = await svc
      .from('venue_stripe_accounts')
      .select('stripe_account_id, charges_enabled')
      .eq('user_id', budget.user_id)
      .maybeSingle()

    if (!stripeAccount?.stripe_account_id || !stripeAccount.charges_enabled) {
      return NextResponse.json({ error: 'El venue no tiene pagos online activados' }, { status: 400 })
    }

    // Helper: get already paid amount for an installment
    async function getPaidAmount(budgetId: string, idx: number): Promise<number> {
      const { data } = await svc
        .from('budget_payments')
        .select('amount')
        .eq('budget_id', budgetId)
        .eq('installment_index', idx)
        .eq('status', 'paid')
      return data?.reduce((s, p) => s + Number(p.amount), 0) || 0
    }

    // Determine what to pay
    let lineItems: any[] = []
    let installmentIndices: number[] = []
    let totalBase = 0

    if (payAll) {
      // Pay all remaining across all unpaid installments
      for (let idx = 0; idx < plan.length; idx++) {
        if (plan[idx].status === 'paid') continue
        const alreadyPaid = await getPaidAmount(budget.id, idx)
        const remaining = plan[idx].amount - alreadyPaid
        if (remaining <= 0) continue
        const amounts = calculateCheckoutAmounts(remaining)
        lineItems.push({
          price_data: {
            currency: 'eur' as const,
            unit_amount: amounts.chargeAmountCents,
            product_data: {
              name: `${plan[idx].label} — ${budget.couple_name}`,
              description: 'Incluye 2,5% de gastos de gestión',
            },
          },
          quantity: 1,
          _meta: { index: idx, baseAmount: remaining },
        })
        installmentIndices.push(idx)
        totalBase += remaining
      }
      if (lineItems.length === 0) {
        return NextResponse.json({ error: 'Todas las cuotas ya están pagadas' }, { status: 400 })
      }
    } else {
      // Single installment payment (full or partial)
      if (installmentIndex < 0 || installmentIndex >= plan.length) {
        return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 400 })
      }
      const inst = plan[installmentIndex]
      if (inst.status === 'paid') {
        return NextResponse.json({ error: 'Esta cuota ya está pagada' }, { status: 400 })
      }

      // Sequential check: can only pay first unpaid
      const firstUnpaidIdx = plan.findIndex((p: any) => p.status !== 'paid')
      if (installmentIndex !== firstUnpaidIdx) {
        return NextResponse.json({ error: 'Debes pagar las cuotas en orden' }, { status: 400 })
      }

      const alreadyPaid = await getPaidAmount(budget.id, installmentIndex)
      const remaining = inst.amount - alreadyPaid

      if (remaining <= 0) {
        return NextResponse.json({ error: 'Esta cuota ya está pagada' }, { status: 400 })
      }

      // Validate custom amount for split payments
      let payAmount = remaining
      if (customAmount != null) {
        const ca = Number(customAmount)
        if (isNaN(ca) || ca < 1 || ca > remaining) {
          return NextResponse.json({ error: `El importe debe estar entre 1€ y ${remaining.toFixed(2)}€` }, { status: 400 })
        }
        payAmount = Math.round(ca * 100) / 100
      }

      const amounts = calculateCheckoutAmounts(payAmount)
      lineItems.push({
        price_data: {
          currency: 'eur' as const,
          unit_amount: amounts.chargeAmountCents,
          product_data: {
            name: `${inst.label} — ${budget.couple_name}`,
            description: payAmount < remaining
              ? `Pago parcial (incluye 2,5% de gastos de gestión)`
              : 'Incluye 2,5% de gastos de gestión',
          },
        },
        quantity: 1,
        _meta: { index: installmentIndex, baseAmount: payAmount },
      })
      installmentIndices = [installmentIndex]
      totalBase = payAmount
    }

    if (totalBase <= 0) {
      return NextResponse.json({ error: 'Importe inválido' }, { status: 400 })
    }

    // Calculate total application fee
    const totalAmounts = calculateCheckoutAmounts(totalBase)

    // Clean _meta from line items before sending to Stripe
    const stripeLineItems = lineItems.map(({ _meta, ...rest }) => rest)

    // Create Checkout Session — use {CHECKOUT_SESSION_ID} template for server-side verification
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: stripeLineItems,
      // Collect payer name + email + billing address for payment history
      customer_creation: 'if_required',
      billing_address_collection: 'required',
      // Collect DNI/NIF + full name via custom fields (required — may differ from cardholder)
      custom_fields: [
        {
          key: 'full_name',
          label: { type: 'custom', custom: 'Nombre completo del titular de la factura' },
          type: 'text',
          optional: false,
        },
        {
          key: 'nif_dni',
          label: { type: 'custom', custom: 'DNI / NIF / Pasaporte' },
          type: 'text',
          optional: false,
        },
      ],
      payment_intent_data: {
        application_fee_amount: totalAmounts.applicationFeeCents,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
      },
      success_url: `${origin}/budget/${budget.slug}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/budget/${budget.slug}`,
      metadata: {
        type: 'budget_installment',
        budget_id: budget.id,
        budget_slug: budget.slug,
        installment_indices: JSON.stringify(installmentIndices),
        venue_user_id: budget.user_id,
        base_amount: String(totalBase),
        pay_all: payAll ? '1' : '0',
      },
    })

    // Store pending payment records
    for (const li of lineItems) {
      await svc.from('budget_payments').insert({
        budget_id: budget.id,
        installment_index: li._meta.index,
        amount: li._meta.baseAmount,
        status: 'pending',
        payment_provider: 'stripe',
        stripe_checkout_session_id: session.id,
      })
    }

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      totalBase,
      chargeAmount: totalAmounts.chargeAmount,
      installmentCount: installmentIndices.length,
    })
  } catch (err: any) {
    console.error('[/api/stripe/create-checkout]', err)
    return NextResponse.json({ error: 'Error al crear sesión de pago' }, { status: 500 })
  }
}
