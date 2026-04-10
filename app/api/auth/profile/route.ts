import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// GET /api/auth/profile
// Returns the venue_profiles row for the authenticated user.
// Uses service role to bypass RLS — required for admin users whose
// profile rows may not be readable via the anon/user-scoped client.

export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ profile: null })
    }

    const svc = getServiceClient()
    const { data, error } = await svc
      .from('venue_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()

    if (error) {
      console.error('[/api/auth/profile]', error.message)
      return NextResponse.json({ profile: null })
    }

    // Auto-create profile if missing (self-registered users)
    if (!data) {
      const { data: created, error: insertErr } = await svc
        .from('venue_profiles')
        .insert({ user_id: session.user.id, role: 'venue_owner' })
        .select()
        .single()

      if (insertErr) {
        console.error('[/api/auth/profile] insert:', insertErr.message)
        return NextResponse.json({ profile: null })
      }
      return NextResponse.json({ profile: created })
    }

    return NextResponse.json({ profile: data })
  } catch (err: any) {
    console.error('[/api/auth/profile]', err)
    return NextResponse.json({ profile: null })
  }
}
