import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendNewLeadEmail } from '@/lib/mailer'

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
    const { wp_venue_id, name, email, phone, guests, date, budget, message, wants_wedding_planner, whatsapp_consent } = body

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

    // Look up the user_venues row so we can store venue_id on the lead
    const { data: venueRow } = await svc
      .from('user_venues')
      .select('id, name')
      .eq('user_id', profile.user_id)
      .eq('wp_venue_id', wp_venue_id)
      .maybeSingle()

    const wedding_date = parseDate(date)

    const { data, error } = await svc.from('leads').insert({
      user_id:               profile.user_id,
      venue_id:              venueRow?.id ?? null,
      status:                'new',
      source:                'wedding_venues_spain',
      name:                  name    || '',
      email:                 email   || '',
      phone:                 phone   || '',
      guests:                guests  ? String(guests) : '',
      wedding_date:          wedding_date,
      budget:                budget  || 'sin_definir',
      initial_message:       message || null,
      language:              null,
      wants_wedding_planner: wants_wedding_planner === true || wants_wedding_planner === 'true' || false,
      whatsapp_consent:      whatsapp_consent === true || whatsapp_consent === 'true' || false,
    }).select().single()

    if (error) {
      console.error('[leads/create]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Send email notification to venue's configured leads emails
    try {
      // Try venue-specific onboarding first, fall back to user-level
      let onb: any = null
      if (venueRow?.id) {
        const { data: venueOnb } = await svc
          .from('venue_onboarding')
          .select('name, ficha_data')
          .eq('user_id', profile.user_id)
          .eq('venue_id', venueRow.id)
          .maybeSingle()
        if (venueOnb?.ficha_data?.leadsEmail) onb = venueOnb
      }
      if (!onb) {
        const { data: fallbackOnb } = await svc
          .from('venue_onboarding')
          .select('name, ficha_data')
          .eq('user_id', profile.user_id)
          .not('ficha_data->>leadsEmail', 'eq', '')
          .not('ficha_data->>leadsEmail', 'is', null)
          .limit(1)
          .maybeSingle()
        onb = fallbackOnb
      }

      const leadsEmailEnabled = onb?.ficha_data?.leadsEmailEnabled !== false
      const rawEmails: string = onb?.ficha_data?.leadsEmail || ''
      const emailList = rawEmails.split(',').map((e: string) => e.trim()).filter(Boolean)

      if (leadsEmailEnabled && emailList.length > 0) {
        await sendNewLeadEmail({
          to:                  emailList,
          venueName:           venueRow?.name || onb?.name || 'Wedding Venues Spain',
          coupleName:          name  || '',
          email:               email || null,
          phone:               phone || null,
          guests:              guests ? String(guests) : null,
          weddingDate:         wedding_date,
          budget:              budget || 'sin_definir',
          message:             message || null,
          wantsWeddingPlanner: wants_wedding_planner === true || wants_wedding_planner === 'true',
          whatsappConsent:     whatsapp_consent === true || whatsapp_consent === 'true',
        })
        console.log('[leads/create] email sent OK')
      }
    } catch (mailErr: any) {
      console.error('[leads/create] EMAIL ERROR:', mailErr?.message, mailErr?.code, mailErr?.responseCode)
      // Non-fatal — lead was created successfully
    }

    return NextResponse.json({ success: true, lead_id: data.id })
  } catch (err: any) {
    console.error('[leads/create]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
