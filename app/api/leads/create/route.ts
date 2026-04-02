import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Parse DD/MM/YYYY → YYYY-MM-DD, returns null if invalid
function parseDate(val: string): string | null {
  if (!val) return null
  const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  return null
}

export async function POST(req: NextRequest) {
  try {
    // Verify secret token
    const token = req.headers.get('X-WVS-Token')
    if (token !== process.env.WVS_REST_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { wp_venue_id, name, email, phone, guests, date, notes } = body

    if (!wp_venue_id) {
      return NextResponse.json({ error: 'Missing wp_venue_id' }, { status: 400 })
    }

    const svc = getServiceClient()

    // Find the venue's user_id from venue_profiles
    const { data: profile } = await svc
      .from('venue_profiles')
      .select('user_id')
      .eq('wp_venue_id', wp_venue_id)
      .single()

    if (!profile?.user_id) {
      return NextResponse.json({ error: 'Venue not found', wp_venue_id }, { status: 404 })
    }

    const wedding_date = parseDate(date)

    const { data, error } = await svc.from('leads').insert({
      user_id:      profile.user_id,
      status:       'new',
      source:       'web',
      name:         name  || '',
      email:        email || '',
      phone:        phone || '',
      guests:       guests ? String(guests) : '',
      wedding_date: wedding_date,
      notes:        notes || '',
    }).select().single()

    if (error) {
      console.error('[leads/create]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, lead_id: data.id })
  } catch (err: any) {
    console.error('[leads/create]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
