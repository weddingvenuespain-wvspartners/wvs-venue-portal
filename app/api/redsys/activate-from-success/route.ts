import { NextResponse } from 'next/server'

// ── DEACTIVATED: Redsys replaced by Stripe Billing ──────────────────────────
// Original code preserved in git history for potential revert.
export async function POST() {
  return NextResponse.json(
    { error: 'Redsys ha sido desactivado. Los pagos se procesan ahora con Stripe.' },
    { status: 410 }
  )
}
