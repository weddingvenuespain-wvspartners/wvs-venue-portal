import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const WP_URL = process.env.NEXT_PUBLIC_WP_URL || 'https://weddingvenuesspain.com'

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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { leadsEmail } = await req.json()

    if (leadsEmail && leadsEmail.split(',').length > 2)
      return NextResponse.json({ error: 'Máximo 2 emails permitidos' }, { status: 400 })

    const svc = getServiceClient()

    // Load current ficha_data and merge leadsEmail
    const { data: onb, error: onbErr } = await svc
      .from('venue_onboarding')
      .select('ficha_data, changes_data')
      .eq('user_id', session.user.id)
      .single()

    if (onbErr || !onb) {
      return NextResponse.json({ error: 'No se encontró la ficha' }, { status: 404 })
    }

    // Merge leadsEmail into ficha_data (and changes_data if exists)
    const updatedFicha = { ...(onb.ficha_data || {}), leadsEmail }
    const updatedChanges = onb.changes_data
      ? { ...(onb.changes_data || {}), leadsEmail }
      : null

    const updatePayload: any = { ficha_data: updatedFicha }
    if (updatedChanges) updatePayload.changes_data = updatedChanges

    await svc
      .from('venue_onboarding')
      .update(updatePayload)
      .eq('user_id', session.user.id)

    // If venue already has a WP post, update email_del_venue directly in WordPress
    const { data: profile } = await svc
      .from('venue_profiles')
      .select('wp_venue_id')
      .eq('user_id', session.user.id)
      .single()

    if (profile?.wp_venue_id) {
      const token = process.env.WVS_REST_TOKEN
      if (token) {
        await fetch(`${WP_URL}/wp-json/wvs/v1/venue/${profile.wp_venue_id}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-WVS-Token': token },
          body: JSON.stringify({ acf: { email_del_venue: leadsEmail } }),
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[save-config]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
