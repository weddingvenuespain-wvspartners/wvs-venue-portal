import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/leads/create',   // uses its own WVS_REST_TOKEN auth
  '/api/admin/backup',   // uses Bearer API key for GitHub Actions cron
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect API routes (pages use client-side auth)
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Skip public API routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) return NextResponse.next()

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
