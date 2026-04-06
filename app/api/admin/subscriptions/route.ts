import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  const { data: me } = await supabase
    .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
  return me?.role === 'admin' ? session : null
}

// ── POST /api/admin/subscriptions ─────────────────────────────────────────────
// Upsert a subscription (create or update) and log the event to history.
// Body: { subscription, event_type?, event_notes? }
export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { subscription, event_type, event_notes, amount, reference } = await req.json()
    if (!subscription?.user_id) {
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
    }

    const svc = getServiceClient()
    const { id, ...payload } = subscription

    let savedSub: any

    if (id) {
      // Fetch previous state to detect what changed
      const { data: prev } = await svc
        .from('venue_subscriptions').select('*').eq('id', id).single()

      const { data, error } = await svc
        .from('venue_subscriptions').update(payload).eq('id', id).select().single()
      if (error) throw error
      savedSub = data

      // Determine event type automatically if not provided
      const resolvedType = event_type
        ?? (prev?.plan_id !== payload.plan_id ? 'plan_changed'
          : payload.status === 'trial'     ? 'trial_started'
          : payload.status === 'active'    ? 'activated'
          : payload.status === 'cancelled' ? 'cancelled'
          : 'note')

      await svc.from('venue_payment_history').insert({
        user_id:        subscription.user_id,
        subscription_id: id,
        event_type:     resolvedType,
        amount:         amount ?? null,
        reference:      reference ?? null,
        plan_id:        payload.plan_id ?? null,
        billing_cycle:  payload.billing_cycle ?? null,
        notes:          event_notes
          ?? (prev?.plan_id !== payload.plan_id
            ? `Migrado de plan anterior a ${payload.plan_id}`
            : 'Suscripción actualizada manualmente'),
      })
    } else {
      const { data, error } = await svc
        .from('venue_subscriptions').insert(payload).select().single()
      if (error) throw error
      savedSub = data

      const resolvedType = event_type
        ?? (payload.status === 'trial' ? 'trial_started' : 'activated')

      await svc.from('venue_payment_history').insert({
        user_id:        subscription.user_id,
        subscription_id: savedSub.id,
        event_type:     resolvedType,
        plan_id:        payload.plan_id ?? null,
        billing_cycle:  payload.billing_cycle ?? null,
        notes:          event_notes
          ?? (payload.status === 'trial'
            ? `Trial iniciado — expira ${payload.trial_end_date}`
            : 'Suscripción creada manualmente'),
      })
    }

    return NextResponse.json({ success: true, subscription: savedSub })
  } catch (err: any) {
    console.error('[/api/admin/subscriptions]', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}

// ── DELETE /api/admin/subscriptions ───────────────────────────────────────────
// Body: { id, user_id }
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { id, user_id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

    const svc = getServiceClient()
    const { error } = await svc.from('venue_subscriptions').delete().eq('id', id)
    if (error) throw error

    if (user_id) {
      await svc.from('venue_payment_history').insert({
        user_id,
        subscription_id: id,
        event_type: 'cancelled',
        notes: 'Suscripción eliminada por admin',
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
