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
  '/api/proposals/track-view',  // anonymous couple opens a proposal — RPC handles dedupe + self-view
  '/api/proposals/unlock',      // password gate for private proposals — anonymous by design
  '/api/proposals/inquiries',   // public POST: couple submits inquiry from proposal landing
  '/api/proposals/track-section', // public POST: section-level view tracking
  // Per-proposal endpoints — public by design, called from /proposal/[slug]
  /^\/api\/proposals\/[^/]+\/visit-slots$/,
  /^\/api\/proposals\/[^/]+\/visit-request$/,
  /^\/api\/proposals\/[^/]+\/select-date$/,
  /^\/api\/proposals\/[^/]+\/menu-selection$/,
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

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  return res
}

export const config = {
  matcher: ['/api/:path*'],
}
