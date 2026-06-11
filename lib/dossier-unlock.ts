import crypto from 'crypto'

// Token stored in the proposal_unlock_<id> cookie. Derived (not the password
// itself) so a stolen cookie never reveals the access password, and the dossier
// page can verify the cookie without re-reading the password. Keyed by the
// server-only service-role secret.
export function dossierUnlockToken(proposalId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  return crypto.createHmac('sha256', secret).update(`dossier-unlock:${proposalId}`).digest('hex')
}
