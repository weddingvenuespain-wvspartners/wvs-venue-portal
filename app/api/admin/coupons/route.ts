import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getStripe } from '@/lib/stripe'

async function requireAdmin(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('venue_profiles').select('role').eq('user_id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

// GET /api/admin/coupons — List all Stripe promotion codes
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const stripe = getStripe()
    const promotionCodes = await stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] })

    const coupons = promotionCodes.data.map((pc: any) => ({
      id: pc.id,
      code: pc.code,
      active: pc.active,
      coupon: {
        id: pc.coupon?.id,
        name: pc.coupon?.name,
        percent_off: pc.coupon?.percent_off,
        amount_off: pc.coupon?.amount_off,
        currency: pc.coupon?.currency,
        duration: pc.coupon?.duration,
        duration_in_months: pc.coupon?.duration_in_months,
        max_redemptions: pc.coupon?.max_redemptions,
        times_redeemed: pc.coupon?.times_redeemed,
      },
      max_redemptions: pc.max_redemptions,
      times_redeemed: pc.times_redeemed,
      expires_at: pc.expires_at,
      created: pc.created,
    }))

    return NextResponse.json({ coupons })
  } catch (err: any) {
    console.error('[admin/coupons GET]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/coupons — Create a new coupon + promotion code
// Body: { code, name, percent_off?, amount_off?, currency?, duration, duration_in_months?, max_redemptions?, expires_at? }
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const body = await req.json()
    const { code, name, percent_off, amount_off, currency, duration, duration_in_months, max_redemptions, expires_at } = body

    if (!code) return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
    if (!percent_off && !amount_off) return NextResponse.json({ error: 'Indica descuento porcentual o fijo' }, { status: 400 })

    const stripe = getStripe()

    // Create coupon first
    const couponParams: any = {
      name: name || code,
      duration: duration || 'once', // 'once', 'repeating', 'forever'
    }
    if (percent_off) couponParams.percent_off = percent_off
    if (amount_off) {
      couponParams.amount_off = Math.round(amount_off * 100) // Stripe uses cents
      couponParams.currency = currency || 'eur'
    }
    if (duration === 'repeating' && duration_in_months) {
      couponParams.duration_in_months = duration_in_months
    }
    if (max_redemptions) couponParams.max_redemptions = max_redemptions

    const coupon = await stripe.coupons.create(couponParams)

    // Create promotion code (the actual string users type)
    const promoParams: any = {
      coupon: coupon.id,
      code: code.toUpperCase(),
    }
    if (max_redemptions) promoParams.max_redemptions = max_redemptions
    if (expires_at) promoParams.expires_at = Math.floor(new Date(expires_at).getTime() / 1000)

    const promo = await stripe.promotionCodes.create(promoParams)

    return NextResponse.json({
      id: promo.id,
      code: promo.code,
      coupon_id: coupon.id,
    })
  } catch (err: any) {
    console.error('[admin/coupons POST]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/coupons — Deactivate a promotion code
// Body: { promoId }
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const { promoId } = await req.json()
    if (!promoId) return NextResponse.json({ error: 'promoId requerido' }, { status: 400 })

    const stripe = getStripe()
    await stripe.promotionCodes.update(promoId, { active: false })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin/coupons DELETE]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
