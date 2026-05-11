// Google Calendar OAuth & API helpers

export type GCalConfig = {
  access_token: string
  refresh_token: string
  token_expiry: string   // ISO
  calendar_id: string
  calendar_name: string
  connected_at: string
  last_sync: string | null
}

export type GCalEvent = {
  id: string
  summary?: string
  start: { date?: string; dateTime?: string }
  end:   { date?: string; dateTime?: string }
  status?: string        // 'confirmed' | 'tentative' | 'cancelled'
  transparency?: string  // 'opaque' (busy) | 'transparent' (free)
}

/** Returns a valid access token, refreshing if expired. `updated` is non-null when tokens changed. */
export async function getValidAccessToken(
  config: GCalConfig
): Promise<{ token: string; updated: GCalConfig | null }> {
  const expiry = new Date(config.token_expiry)
  if (expiry.getTime() - Date.now() > 60_000) {
    return { token: config.access_token, updated: null }
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: config.refresh_token,
      grant_type:    'refresh_token',
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token refresh failed: ${body}`)
  }

  const data = await res.json()
  const updated: GCalConfig = {
    ...config,
    access_token: data.access_token,
    token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  }
  return { token: data.access_token, updated }
}

/** Fetch events from Google Calendar between two ISO date strings. */
export async function fetchCalendarEvents(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GCalEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  })

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Calendar fetch failed: ${body}`)
  }

  const data = await res.json()
  return (data.items ?? []) as GCalEvent[]
}

/** Convert Google Calendar events to a set of blocked ISO date strings (full-day only for now). */
export function eventsToBlockedDates(events: GCalEvent[]): string[] {
  const dates = new Set<string>()

  for (const ev of events) {
    if (ev.status === 'cancelled') continue
    if (ev.transparency === 'transparent') continue  // free/available

    if (ev.start.date) {
      // All-day event: start.date = "YYYY-MM-DD", end.date = exclusive day after
      const start = new Date(ev.start.date)
      const end   = new Date(ev.end.date!)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        dates.add(d.toISOString().slice(0, 10))
      }
    }
    // Timed events: skip for now — only all-day events block visits
  }

  return [...dates].sort()
}
