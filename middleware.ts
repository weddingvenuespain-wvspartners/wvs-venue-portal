import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that don't require authentication.
// String entries match by prefix; RegExp entries match the full pathname.
const PUBLIC_ROUTES: Array<string | RegExp> = [
  '/api/leads/create',          // uses its own WVS_REST_TOKEN auth
  '/api/admin/backup',          // uses Bearer API key for GitHub Actions cron
  '/api/redsys/notification',   // Redsys webhook (server-to-server, no session)
  '/api/plans',                 // public plan listing for pricing page
  '/api/dossier/track-view',  // anonymous couple opens a dossier — RPC handles dedupe + self-view
  '/api/dossier/unlock',      // password gate for private dossiers — anonymous by design
  '/api/dossier/inquiries',   // public POST: couple submits inquiry from dossier landing
  '/api/dossier/track-section', // public POST: section-level view tracking
  // Per-dossier endpoints — public by design, called from /dossier/[slug]
  /^\/api\/dossier\/[^/]+\/visit-slots$/,
  /^\/api\/dossier\/[^/]+\/visit-request$/,
  /^\/api\/dossier\/[^/]+\/select-date$/,
  /^\/api\/dossier\/[^/]+\/menu-selection$/,
]

const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTES.some(r => typeof r === 'string' ? pathname.startsWith(r) : r.test(pathname))

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect API routes (pages use client-side auth)
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Skip public API routes
  if (isPublicRoute(pathname)) return NextResponse.next()

  // Verify Supabase session via cookies
  const res = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => req.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => { res.cookies.set({ name, value, ...options }) },
        remove: (name: string, options: any) => { res.cookies.set({ name, value: '', ...options }) },
      },
    }
  )

  // Use getUser() (validates the JWT against Supabase Auth) instead of
  // getSession() (which only decodes the cookie locally and trusts it).
  // The middleware is the only server-side gate for most API routes, so the
  // check must be authoritative.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
