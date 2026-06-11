// Supabase Auth returns its error messages in English; map the common ones to
// Spanish before showing them to the user. Unknown messages fall back to a
// generic copy (the original is logged for debugging).
export function translateAuthError(message: string | undefined): string {
  const msg = (message || '').toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('email not confirmed')) return 'Tu email aún no está confirmado. Revisa tu bandeja de entrada.'
  if (msg.includes('rate limit') || msg.includes('too many requests')) return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.'
  if (msg.includes('password should be at least')) return 'La contraseña debe tener al menos 8 caracteres.'
  if (msg.includes('new password should be different')) return 'La nueva contraseña debe ser distinta a la anterior.'
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('invalid format')) return 'El email no es válido.'
  if (msg.includes('network') || msg.includes('fetch')) return 'No hay conexión. Comprueba tu red e inténtalo de nuevo.'
  if (message) console.error('[auth] Unmapped Supabase error:', message)
  return 'Algo ha ido mal. Inténtalo de nuevo.'
}

export function isDuplicateUserError(message: string | undefined): boolean {
  const msg = (message || '').toLowerCase()
  return msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')
}
