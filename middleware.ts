import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// La protección de rutas se gestiona en cada página via useAuth + redirect client-side.
// El middleware solo se ocupa de las rutas públicas que no necesitan el sidebar.
export function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
