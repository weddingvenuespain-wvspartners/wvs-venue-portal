import { getServiceClient } from './auth-server'

/**
 * DB-backed rate limiter (works across serverless instances, unlike in-memory).
 * Records each attempt in rate_limit_attempts and returns whether the caller is
 * still under `max` attempts within the trailing `windowSec` window.
 *
 * Fails open on infrastructure errors (returns allowed) so a DB hiccup never
 * locks out legitimate users — the limiter is a brute-force speed bump, not the
 * primary auth control.
 */
export async function checkRateLimit(
  bucket: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const svc = getServiceClient()
    await svc.from('rate_limit_attempts').insert({ bucket })

    const since = new Date(Date.now() - windowSec * 1000).toISOString()
    const { count } = await svc
      .from('rate_limit_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('bucket', bucket)
      .gte('created_at', since)

    return (count ?? 0) <= max
  } catch {
    return true
  }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}
