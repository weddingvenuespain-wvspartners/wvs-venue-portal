import { NextResponse } from 'next/server'
import { getSession, getServiceClient } from '@/lib/auth-server'

// POST /api/auth/ensure-profile
// Creates a venue_profiles row for the authenticated user if one doesn't exist.
// Used by auth-context for self-registered users (admin-created users already have one).

export async function POST() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const userId = session.user.id
    const svc = getServiceClient()

    // Check if profile already exists
    const { data: existing } = await svc
      .from('venue_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ exists: true })
    }

    // Create minimal profile
    const { error } = await svc.from('venue_profiles').insert({
      user_id: userId,
      role: 'venue_owner',
    })

    if (error) {
      console.error('[ensure-profile] Insert error:', error.message)
      return NextResponse.json({ error: 'Error creando perfil' }, { status: 500 })
    }

    return NextResponse.json({ created: true })
  } catch (err: any) {
    console.error('[ensure-profile]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
