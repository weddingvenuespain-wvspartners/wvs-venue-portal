import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendCancellationConfirmEmail } from '@/lib/mailer'
import { getStripe } from '@/lib/stripe'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── POST /api/subscription/cancel ────────────────────────────────────────────
// User self-cancels their subscription. Marks as cancelled, effective at end of
// current billing period (renewal_date). Logs event to payment history.
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

    const { reason } = await req.json().catch(() => ({ reason: '' }))

    // Require minimum 50 words
    const wordCount = (reason || '').trim().split(/\s+/).filter(Boolean).length
    if (wordCount < 50) {
      return NextResponse.json({ error: 'Debes escribir al menos 50 palabras explicando el motivo de cancelación.' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Find active subscription
    const { data: sub } = await svc
      .from('venue_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'trial'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!sub) {
      return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
    }

    // Mark subscription as cancelled — stays active until renewal_date
    const cancelDate = new Date().toISOString().slice(0, 10)
    const effectiveEnd = sub.renewal_date || cancelDate

    await svc.from('venue_subscriptions').update({
      status: 'cancelled',
      cancel_requested_at: cancelDate,
      cancel_effective_at: effectiveEnd,
    }).eq('id', sub.id)

    // Cancel in Stripe (cancel at period end, not immediately)
    if (sub.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.update(sub.stripe_subscription_id, {
          cancel_at_period_end: true,
        })
      } catch (stripeErr) {
        console.error('[cancel] Stripe cancellation failed:', stripeErr)
        // Continue — local cancellation is the source of truth
      }
    }

    // Log event
    await svc.from('venue_payment_history').insert({
      user_id: user.id,
      subscription_id: sub.id,
      event_type: 'cancelled',
      notes: `Cancelación solicitada por el usuario${reason ? `. Motivo: ${reason}` : ''}. Efectiva el ${effectiveEnd}.`,
    })

    // Send confirmation email
    const { data: venue } = await svc.from('venue_onboarding').select('name').eq('user_id', user.id).maybeSingle()
    try {
      await sendCancellationConfirmEmail({
        to: user.email!,
        venueName: venue?.name || 'Tu espacio',
        effectiveDate: effectiveEnd,
      })
    } catch (emailErr) {
      console.error('[cancel] Email send failed:', emailErr)
    }

    return NextResponse.json({
      success: true,
      effective_date: effectiveEnd,
      message: `Tu suscripción se cancelará el ${effectiveEnd}. Hasta esa fecha podrás seguir usando la plataforma.`,
    })
  } catch (err: any) {
    console.error('[/api/subscription/cancel]', err)
    return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 })
  }
}
