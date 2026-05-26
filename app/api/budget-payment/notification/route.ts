import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  decodeMerchantParams,
  verifySignature,
  isResponseAuthorized,
} from '@/lib/redsys'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// POST /api/budget-payment/notification
// Called by Redsys server-to-server after budget installment payment

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const merchantParamsB64 = formData.get('Ds_MerchantParameters') as string
    const signature = formData.get('Ds_Signature') as string

    if (!merchantParamsB64 || !signature) {
      console.error('[budget-payment/notification] Missing params')
      return new NextResponse('KO', { status: 400 })
    }

    if (!verifySignature(merchantParamsB64, signature)) {
      console.error('[budget-payment/notification] Invalid signature')
      return new NextResponse('KO', { status: 403 })
    }

    const params = decodeMerchantParams(merchantParamsB64)
    const responseCode = params.Ds_Response
    const order = params.Ds_Order
    const authCode = params.Ds_AuthorisationCode

    let merchantData: {
      type?: string
      budgetId?: string
      budgetSlug?: string
      installmentIndex?: number
      venueUserId?: string
    } = {}
    try {
      const raw = params.Ds_MerchantData
      if (raw) merchantData = JSON.parse(raw)
    } catch { /* ignore */ }

    console.log(`[budget-payment/notification] Order=${order} Response=${responseCode} Budget=${merchantData.budgetId} Installment=${merchantData.installmentIndex}`)

    const svc = getServiceClient()

    if (!isResponseAuthorized(responseCode)) {
      console.warn(`[budget-payment/notification] Payment declined: ${responseCode}`)
      // Update payment record as failed
      await svc.from('budget_payments')
        .update({ status: 'failed' })
        .eq('redsys_order', order)
      return new NextResponse('OK')
    }

    // Payment authorized — mark installment as paid
    const { budgetId, installmentIndex } = merchantData
    if (!budgetId || installmentIndex == null) {
      console.error('[budget-payment/notification] Missing budgetId or installmentIndex')
      return new NextResponse('OK')
    }

    // Update payment record
    await svc.from('budget_payments')
      .update({
        status: 'paid',
        redsys_auth_code: authCode || null,
        paid_at: new Date().toISOString(),
      })
      .eq('redsys_order', order)

    // Update budget payment_plan installment status
    const { data: budget } = await svc
      .from('budgets')
      .select('payment_plan')
      .eq('id', budgetId)
      .single()

    if (budget?.payment_plan) {
      const plan = [...(budget.payment_plan as any[])]
      if (plan[installmentIndex]) {
        plan[installmentIndex] = {
          ...plan[installmentIndex],
          status: 'paid',
          paid_at: new Date().toISOString(),
        }
        await svc.from('budgets')
          .update({ payment_plan: plan })
          .eq('id', budgetId)
      }
    }

    // If budget status is draft/sent, update to accepted
    await svc.from('budgets')
      .update({ status: 'accepted' })
      .eq('id', budgetId)
      .in('status', ['draft', 'sent', 'viewed'])

    console.log(`[budget-payment/notification] Installment ${installmentIndex} paid for budget ${budgetId}`)
    return new NextResponse('OK')
  } catch (err: any) {
    console.error('[budget-payment/notification] Error:', err)
    return new NextResponse('OK')
  }
}
