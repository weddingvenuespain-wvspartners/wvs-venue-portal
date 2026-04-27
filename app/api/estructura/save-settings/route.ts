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

// POST /api/estructura/save-settings
// Body: partial venue_settings patch (e.g. { visit_availability: {...} })
// Reads the current row, merges, and writes back — safe against column overwrites.
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

    const patch = await req.json()

    const svc = getServiceClient()

    const { data: current } = await svc
      .from('venue_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const { error } = await svc
      .from('venue_settings')
      .upsert({ ...(current || {}), ...patch, user_id: user.id }, { onConflict: 'user_id' })

    if (error) {
      console.error('[save-settings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[save-settings]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
