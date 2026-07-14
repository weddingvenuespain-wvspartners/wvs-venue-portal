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

    const { leadsEmail, leadsEmailEnabled, venue_id } = await req.json()

    if (leadsEmail && leadsEmail.split(',').length > 2)
      return NextResponse.json({ error: 'Máximo 2 emails permitidos' }, { status: 400 })

    const svc = getServiceClient()

    // Load current ficha_data and merge leadsEmail
    let onbQuery = svc
      .from('venue_onboarding')
      .select('ficha_data, changes_data')
      .eq('user_id', user.id)
    if (venue_id) onbQuery = onbQuery.eq('venue_id', venue_id)
    const { data: onb, error: onbErr } = await onbQuery.single()

    if (onbErr || !onb) {
      return NextResponse.json({ error: 'No se encontró la ficha' }, { status: 404 })
    }

    // Merge leadsEmail + leadsEmailEnabled into ficha_data (and changes_data if exists)
    const updatedFicha = { ...(onb.ficha_data || {}), leadsEmail, leadsEmailEnabled: leadsEmailEnabled !== false }
    const updatedChanges = onb.changes_data
      ? { ...(onb.changes_data || {}), leadsEmail, leadsEmailEnabled: leadsEmailEnabled !== false }
      : null

    const updatePayload: any = { ficha_data: updatedFicha }
    if (updatedChanges) updatePayload.changes_data = updatedChanges

    let updateQuery = svc
      .from('venue_onboarding')
      .update(updatePayload)
      .eq('user_id', user.id)
    if (venue_id) updateQuery = updateQuery.eq('venue_id', venue_id)
    const { error: updateErr } = await updateQuery
    if (updateErr) {
      console.error('[save-config] update error', updateErr)
      return NextResponse.json({ error: 'Error al guardar la configuración' }, { status: 500 })
    }

    // Los emails de leads viven solo en ficha_data: /api/leads/create los lee
    // de ahí. Ya no se sincronizan a WordPress (web antigua retirada).
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[save-config]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
