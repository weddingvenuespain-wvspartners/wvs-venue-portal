import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  decodeMerchantParams,
  verifySignature,
  isResponseAuthorized,
} from '@/lib/redsys'

// Supabase service client (bypasses RLS — needed because webhook has no user session)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// POST /api/redsys/notification
// Called by Redsys server-to-server after payment completes.
// Content-Type: application/x-www-form-urlencoded

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const merchantParamsB64 = formData.get('Ds_MerchantParameters') as string
    const signature         = formData.get('Ds_Signature') as string
    const signatureVersion  = formData.get('Ds_SignatureVersion') as string

    if (!merchantParamsB64 || !signature) {
      console.error('[redsys/notification] Missing params')
      return new NextResponse('KO', { status: 400 })
    }

    // Verify signature
    if (!verifySignature(merchantParamsB64, signature)) {
      console.error('[redsys/notification] Invalid signature')
      return new NextResponse('KO', { status: 403 })
    }

    // Decode response
    const params = decodeMerchantParams(merchantParamsB64)
    const responseCode = params.Ds_Response
    const order        = params.Ds_Order
    const amount       = params.Ds_Amount
    const authCode     = params.Ds_AuthorisationCode

    // Token fields (only present if tokenization was requested)
    const token    = params.Ds_Merchant_Identifier
    const cofTxnId = params.Ds_Merchant_Cof_Txnid
    const cardExpiry  = params.Ds_ExpiryDate     // YYMM
    const cardNumber  = params.Ds_Card_Number     // masked PAN
    const cardBrand   = params.Ds_Card_Brand      // 1=VISA, 2=MC, etc.

    // Parse merchant data (userId, planId, cycleId, intervalMonths)
    let merchantData: { userId?: string; planId?: string; cycleId?: string; intervalMonths?: number } = {}
    try {
      const raw = params.Ds_MerchantData
      if (raw) merchantData = JSON.parse(raw)
    } catch { /* ignore parse errors */ }

    const { userId, planId, cycleId, intervalMonths } = merchantData

    console.log(`[redsys/notification] Order=${order} Response=${responseCode} Auth=${authCode} User=${userId}`)

    if (!isResponseAuthorized(responseCode)) {
      console.warn(`[redsys/notification] Payment declined: ${responseCode}`)
      // Log failed attempt
      if (userId) {
        const svc = getServiceClient()
        await svc.from('venue_payment_history').insert({
          user_id: userId,
          event_type: 'payment_failed',
          amount: amount ? parseInt(amount, 10) / 100 : null,
          reference: order,
          plan_id: planId || null,
          billing_cycle: cycleId || null,
          notes: `Redsys respuesta ${responseCode} — pedido ${order}`,
        })
      }
      return new NextResponse('OK')
    }

    // Payment authorized — activate subscription
    if (!userId || !planId) {
      console.error('[redsys/notification] Missing userId or planId in merchantData')
      return new NextResponse('OK') // Still return OK to Redsys
    }

    const svc = getServiceClient()

    // Cancel any existing active/trial subscriptions for this user
    await svc
      .from('venue_subscriptions')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .in('status', ['active', 'trial'])

    // Create new active subscription
    const months = intervalMonths || 1
    const periodEnd = new Date()
    periodEnd.setMonth(periodEnd.getMonth() + months)

    const subscriptionData: Record<string, any> = {
      user_id: userId,
      plan_id: planId,
      status: 'active',
      billing_cycle: cycleId || 'monthly',
      start_date: new Date().toISOString().slice(0, 10),
      renewal_date: periodEnd.toISOString().slice(0, 10),
    }

    // Store token for recurring charges
    if (token) {
      subscriptionData.redsys_token = token
      subscriptionData.redsys_cof_txnid = cofTxnId || null
      subscriptionData.redsys_card_expiry = cardExpiry || null
      subscriptionData.redsys_card_number = cardNumber || null
      subscriptionData.redsys_card_brand = cardBrand || null
    }

    const { data: sub, error: subError } = await svc
      .from('venue_subscriptions')
      .insert(subscriptionData)
      .select()
      .single()

    if (subError) {
      console.error('[redsys/notification] Error creating subscription:', subError)
      return new NextResponse('OK')
    }

    // Log payment in history
    await svc.from('venue_payment_history').insert({
      user_id: userId,
      subscription_id: sub.id,
      event_type: 'payment_received',
      amount: amount ? parseInt(amount, 10) / 100 : null,
      reference: order,
      plan_id: planId,
      billing_cycle: cycleId || 'monthly',
      notes: `Pago Redsys autorizado — pedido ${order} — auth ${authCode}`,
    })

    console.log(`[redsys/notification] Subscription activated for user ${userId}`)
    return new NextResponse('OK')
  } catch (err: any) {
    console.error('[redsys/notification] Unexpected error:', err)
    return new NextResponse('OK') // Always return OK to prevent Redsys retries
  }
}
