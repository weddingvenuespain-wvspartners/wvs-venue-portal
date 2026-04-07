import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

    const body = await req.json()
    const { ficha_data, status, changes_data, changes_status } = body

    const VALID_STATUS = ['draft', 'submitted']
    const VALID_CHANGES_STATUS = ['draft', 'submitted']
    if (status !== undefined && !VALID_STATUS.includes(status))
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
    if (changes_status !== undefined && !VALID_CHANGES_STATUS.includes(changes_status))
      return NextResponse.json({ error: 'Estado de cambios no válido' }, { status: 400 })

    const update: Record<string, any> = { user_id: session.user.id }
    if (ficha_data !== undefined)    update.ficha_data    = ficha_data
    if (status !== undefined)        update.status        = status
    if (changes_data !== undefined)  update.changes_data  = changes_data
    if (changes_status !== undefined) update.changes_status = changes_status
    if (status === 'submitted')      update.submitted_at  = new Date().toISOString()

    // Keep name in sync for admin display
    if (ficha_data?.H1_Venue) update.name = ficha_data.H1_Venue

    const { error } = await supabase
      .from('venue_onboarding')
      .upsert(update, { onConflict: 'user_id' })

    if (error) { console.error('[save-draft] DB error:', error.message); return NextResponse.json({ error: 'Error al guardar' }, { status: 500 }) }
    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[/api/venues/save-draft]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
