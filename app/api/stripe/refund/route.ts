// POST /api/stripe/refund
// Venue-authenticated endpoint to refund a budget payment.
// Platform initiates the refund (Express accounts can't self-refund).

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { paymentId } = await req.json()
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId requerido' }, { status: 400 })
    }

    const svc = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    )

    // Fetch payment record
    const { data: payment } = await svc
      .from('budget_payments')
      .select('id, budget_id, installment_index, amount, status, stripe_payment_intent_id, payment_provider')
      .eq('id', paymentId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })
    }

    if (payment.status !== 'paid') {
      return NextResponse.json({ error: 'Solo se pueden reembolsar pagos completados' }, { status: 400 })
    }

    if (payment.payment_provider !== 'stripe' || !payment.stripe_payment_intent_id) {
      return NextResponse.json({ error: 'Solo se pueden reembolsar pagos de Stripe' }, { status: 400 })
    }

    // Verify venue owns this budget
    const { data: budget } = await svc
      .from('budgets')
      .select('user_id')
      .eq('id', payment.budget_id)
      .single()

    if (!budget || budget.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Issue refund via Stripe
    const stripe = getStripe()
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    })

    // Update payment record
    await svc.from('budget_payments')
      .update({ status: 'refunded', paid_at: null })
      .eq('id', paymentId)

    // Update budget payment_plan — recalculate from payments
    const { data: allPayments } = await svc
      .from('budget_payments')
      .select('installment_index, amount, status')
      .eq('budget_id', payment.budget_id)
      .eq('status', 'paid')

    const { data: budgetData } = await svc
      .from('budgets')
      .select('payment_plan')
      .eq('id', payment.budget_id)
      .single()

    if (budgetData?.payment_plan) {
      const plan = [...(budgetData.payment_plan as any[])]
      // Recalculate installment status based on remaining paid amounts
      const paidByIndex: Record<number, number> = {}
      for (const p of allPayments || []) {
        paidByIndex[p.installment_index] = (paidByIndex[p.installment_index] || 0) + Number(p.amount)
      }
      for (let idx = 0; idx < plan.length; idx++) {
        const totalPaid = paidByIndex[idx] || 0
        if (totalPaid >= plan[idx].amount) {
          // Still fully paid
        } else {
          // Revert to pending
          plan[idx] = { ...plan[idx], status: 'pending', paid_at: null }
        }
      }
      await svc.from('budgets')
        .update({ payment_plan: plan })
        .eq('id', payment.budget_id)
    }

    return NextResponse.json({
      success: true,
      refundId: refund.id,
      amount: Number(payment.amount),
    })
  } catch (err: any) {
    console.error('[/api/stripe/refund]', err)
    return NextResponse.json({ error: 'Error al procesar el reembolso' }, { status: 500 })
  }
}
