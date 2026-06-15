import { NextResponse } from 'next/server'

// ── DEACTIVATED: Redsys replaced by Stripe Billing ──────────────────────────
// Original code (with security-audit fixes: signature verification, amount
// validation, idempotency, and payment anomaly logging) preserved in git
// history for potential revert.
export async function POST() {
  return new NextResponse('Gone — payments processed via Stripe', { status: 410 })
}
