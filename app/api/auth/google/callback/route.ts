import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { GCalConfig } from '@/lib/google-calendar'
import { getValidAccessToken, fetchCalendarEvents, eventsToBlockedDates } from '@/lib/google-calendar'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

// GET /api/auth/google/callback  — Google redirects here after user consent.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(`${APP_URL}/venue-settings?gcal=error`)
  }

  let userId: string, venueId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId  = decoded.user_id
    venueId = decoded.venue_id
    if (!userId || !venueId) throw new Error()
  } catch {
    return NextResponse.redirect(`${APP_URL}/venue-settings?gcal=error`)
  }

  // Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${APP_URL}/api/auth/google/callback`,
      grant_type:    'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    console.error('[gcal callback] token exchange failed', await tokenRes.text())
    return NextResponse.redirect(`${APP_URL}/venue-settings?gcal=error`)
  }

  const tokens = await tokenRes.json()

  // Get primary calendar info
  let calendarId   = 'primary'
  let calendarName = 'Google Calendar'
  try {
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    if (calRes.ok) {
      const cal = await calRes.json()
      calendarId   = cal.id ?? 'primary'
      calendarName = cal.summary ?? 'Google Calendar'
    }
  } catch { /* use defaults */ }

  const gcalConfig: GCalConfig = {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expiry:  new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    calendar_id:   calendarId,
    calendar_name: calendarName,
    connected_at:  new Date().toISOString(),
    last_sync:     null,
  }

  const db = svc()

  // Save google_calendar config to venue_settings
  const { data: existing } = await db
    .from('venue_settings')
    .select('visit_availability')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .maybeSingle()

  if (!existing) {
    console.error('[gcal callback] venue_settings row not found')
    return NextResponse.redirect(`${APP_URL}/venue-settings?gcal=error`)
  }

  await db
    .from('venue_settings')
    .update({ google_calendar: gcalConfig })
    .eq('user_id', userId)
    .eq('venue_id', venueId)

  // Initial sync — fetch events and update google_blocked_dates
  try {
    const now     = new Date()
    const horizon = new Date(now); horizon.setFullYear(horizon.getFullYear() + 1)
    const events  = await fetchCalendarEvents(
      tokens.access_token,
      calendarId,
      now.toISOString(),
      horizon.toISOString()
    )
    const googleBlockedDates = eventsToBlockedDates(events)
    const currentAvail = existing.visit_availability ?? {}
    await db
      .from('venue_settings')
      .update({
        google_calendar: { ...gcalConfig, last_sync: new Date().toISOString() },
        visit_availability: { ...currentAvail, google_blocked_dates: googleBlockedDates },
      })
      .eq('user_id', userId)
      .eq('venue_id', venueId)
  } catch (e) {
    console.error('[gcal callback] initial sync failed', e)
    // Non-fatal — connection still succeeded
  }

  return NextResponse.redirect(`${APP_URL}/venue-settings?gcal=connected`)
}
