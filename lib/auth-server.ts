import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/** Supabase client scoped to the authenticated user (respects RLS) */
export async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n: string) => cookieStore.get(n)?.value } }
  )
}

/** Supabase client with service role (bypasses RLS) — use only for admin ops */
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/** Get the current session. Returns null if not authenticated. */
export async function getSession() {
  const supabase = await getUserClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

/**
 * Check if current user is admin.
 * Returns { session, userId } or null if not admin.
 */
export async function checkAdmin() {
  const session = await getSession()
  if (!session) return null
  const supabase = await getUserClient()
  const { data: profile } = await supabase
    .from('venue_profiles').select('role').eq('user_id', session.user.id).single()
  if (profile?.role !== 'admin') return null
  return { session, userId: session.user.id }
}
