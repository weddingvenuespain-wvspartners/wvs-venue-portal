import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ── GET — Fetch current payment method info ──────────────────────────────────
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const svc = getServiceClient()
  const { data: sub } = await svc
    .from('venue_subscriptions')
    .select('iban, account_holder, mandate_ref')
    .eq('user_id', user.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return NextResponse.json({ iban: null, account_holder: null, mandate_ref: null })

  // Mask IBAN: show last 4 chars only
  const maskedIban = sub.iban
    ? '****' + sub.iban.replace(/\s/g, '').slice(-4)
    : null

  return NextResponse.json({
    iban: maskedIban,
    account_holder: sub.account_holder,
    mandate_ref: sub.mandate_ref,
    hasPaymentMethod: !!sub.iban,
  })
}

// ── POST — Update payment method (IBAN + holder name) ────────────────────────
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { iban, account_holder } = await req.json()

  // Basic IBAN validation (ES format: ES + 22 digits)
  const cleanIban = (iban || '').replace(/\s/g, '').toUpperCase()
  if (!cleanIban || cleanIban.length < 15 || cleanIban.length > 34) {
    return NextResponse.json({ error: 'IBAN no válido' }, { status: 400 })
  }
  if (!account_holder || account_holder.trim().length < 2) {
    return NextResponse.json({ error: 'Nombre del titular requerido' }, { status: 400 })
  }

  const svc = getServiceClient()

  // Find active subscription
  const { data: sub } = await svc
    .from('venue_subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub) {
    return NextResponse.json({ error: 'No se encontró suscripción activa' }, { status: 404 })
  }

  // Update subscription with new payment method
  const { error } = await svc.from('venue_subscriptions').update({
    iban: cleanIban,
    account_holder: account_holder.trim(),
  }).eq('id', sub.id)

  if (error) {
    console.error('[payment-method]', error)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }

  // Log event
  await svc.from('venue_payment_history').insert({
    user_id: user.id,
    subscription_id: sub.id,
    event_type: 'note',
    notes: 'Método de pago actualizado por el usuario.',
  })

  return NextResponse.json({ success: true, message: 'Método de pago actualizado correctamente.' })
}
