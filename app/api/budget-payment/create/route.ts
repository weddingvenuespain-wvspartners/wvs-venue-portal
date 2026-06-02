import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildRedirectFormData, generateOrderNumber } from '@/lib/redsys'

// Service client — no user session (public page)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// POST /api/budget-payment/create
// Body: { slug: string, installmentIndex: number }
// Returns Redsys form data for redirect payment

export async function POST(req: NextRequest) {
  try {
    const { slug, installmentIndex } = await req.json()
    if (!slug || installmentIndex == null) {
      return NextResponse.json({ error: 'slug e installmentIndex requeridos' }, { status: 400 })
    }

    const supabase = getServiceClient()

    // Fetch budget
    const { data: budget, error: budgetError } = await supabase
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
    if (installmentIndex < 0 || installmentIndex >= plan.length) {
      return NextResponse.json({ error: 'Cuota no encontrada' }, { status: 400 })
    }

    const installment = plan[installmentIndex]
    if (installment.status === 'paid') {
      return NextResponse.json({ error: 'Esta cuota ya esta pagada' }, { status: 400 })
    }

    const amountCents = Math.round(installment.amount * 100)
    if (amountCents <= 0) {
      return NextResponse.json({ error: 'Importe invalido' }, { status: 400 })
    }

    const order = generateOrderNumber()
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || ''

    // Store pending payment record
    await supabase.from('budget_payments').insert({
      budget_id: budget.id,
      installment_index: installmentIndex,
      amount: installment.amount,
      redsys_order: order,
      status: 'pending',
    })

    const merchantData = JSON.stringify({
      type: 'budget_installment',
      budgetId: budget.id,
      budgetSlug: budget.slug,
      installmentIndex,
      venueUserId: budget.user_id,
    })

    const formData = buildRedirectFormData({
      amountCents,
      order,
      notificationUrl: `${origin}/api/budget-payment/notification`,
      successUrl: `${origin}/budget/${budget.slug}?paid=1&cuota=${installmentIndex}`,
      errorUrl: `${origin}/budget/${budget.slug}?error=1&cuota=${installmentIndex}`,
      merchantData,
      language: '1',
    })

    return NextResponse.json({
      success: true,
      formData,
      installment: {
        label: installment.label,
        amount: installment.amount,
      },
    })
  } catch (err: any) {
    console.error('[/api/budget-payment/create]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
