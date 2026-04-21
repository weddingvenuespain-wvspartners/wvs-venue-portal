import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// POST /api/wp/request-venue
// Creates a lead for the venue + links it to the wp_client, bypassing RLS
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    venue_user_id,
    client_id,
    client_data,
    note,
  } = body

  if (!venue_user_id || !client_id || !client_data) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const plannerId = session.user.id
  const service = getServiceClient()

  // 1. Create lead in the venue's system
  const { data: lead, error: leadErr } = await service.from('leads').insert({
    user_id:      venue_user_id,
    planner_id:   plannerId,
    name:         client_data.name,
    email:        client_data.email        || null,
    phone:        client_data.phone        || null,
    wedding_date: client_data.wedding_date || null,
    guests:       client_data.guest_count  || null,
    budget:       client_data.budget       || 'sin_definir',
    source:       'wedding_planner',
    status:       'new',
    notes:        note || null,
  }).select('id').single()

  if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })

  // 2. Link venue to client (upsert in case it already exists)
  const { data: wv, error: wvErr } = await service
    .from('wp_client_venues')
    .upsert({
      client_id:           client_id,
      planner_id:          plannerId,
      venue_user_id:       venue_user_id,
      lead_id:             lead?.id || null,
      availability_status: 'requested',
      planner_notes:       note || null,
    }, { onConflict: 'client_id,venue_user_id' })
    .select()
    .single()

  if (wvErr) return NextResponse.json({ error: wvErr.message }, { status: 500 })

  return NextResponse.json({ lead, wv })
}
