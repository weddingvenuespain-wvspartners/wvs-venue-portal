'use client'

/**
 * Empty state shown when a venue-owner user has no activeVenue.
 * Typically means their account hasn't been fully set up yet.
 */
export default function NoVenueState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center', maxWidth: 420, margin: '40px auto',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 14,
        background: 'var(--cream, #faf7f2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, fontSize: 24,
      }}>
        🏛️
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--charcoal, #2d2926)', margin: '0 0 8px' }}>
        Sin venue asignado
      </h2>
      <p style={{ fontSize: 13, color: 'var(--warm-gray, #9e9490)', margin: 0, lineHeight: 1.5 }}>
        Tu cuenta no tiene un venue asociado todavia. Contacta con el equipo de Wedding Venues Spain para activar tu espacio.
      </p>
    </div>
  )
}
