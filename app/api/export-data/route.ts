import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    )

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch all user data in parallel
    const [profileRes, leadsRes, proposalsRes, subscriptionRes] = await Promise.all([
      supabase.from('venue_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('leads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('proposals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('venue_subscriptions').select('*, plan:venue_plans(*)').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])

    const exportData = {
      exportado_el: new Date().toISOString(),
      perfil: profileRes.data ?? null,
      leads: leadsRes.data ?? [],
      propuestas: proposalsRes.data ?? [],
      suscripcion: subscriptionRes.data ?? null,
    }

    const json = JSON.stringify(exportData, null, 2)
    const date = new Date().toISOString().slice(0, 10)

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="wvs-mis-datos-${date}.json"`,
      },
    })
  } catch (err: any) {
    console.error('[/api/export-data]', err)
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 })
  }
}
