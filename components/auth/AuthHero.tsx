import { Stars } from './Stars'

export function GradientWord({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'linear-gradient(180deg, #FFF8E7 20%, #E0B96B 115%)',
      WebkitBackgroundClip: 'text',
      backgroundClip: 'text',
      color: 'transparent',
    }}>
      {children}
    </span>
  )
}

// Display is controlled by the .fe-brand / .fe-form-brand classes (the latter
// hides the brand on desktop, where the hero already shows it).
// tone='cream' for dark surfaces (hero), tone='dark' for the light canvas.
export function AuthBrand({ size = 26, className, tone = 'cream' }: { size?: number; className?: string; tone?: 'cream' | 'dark' }) {
  const dark = tone === 'dark'
  return (
    <div className={`fe-brand${className ? ` ${className}` : ''}`} style={{ alignItems: 'center', gap: 10 }}>
      <img
        src={dark ? '/foreventos-assets/foreventos-icon-dark.svg' : '/foreventos-assets/foreventos-icon-cream.svg'}
        alt="ForEventos"
        style={{ height: size, width: 'auto', display: 'block' }}
      />
      <span style={{ fontFamily: "'Satoshi','Inter',sans-serif", fontWeight: 700, letterSpacing: 0.5, fontSize: size * 0.7, color: dark ? '#1A2419' : '#F5F4EE' }}>
        FOREVENTOS
      </span>
    </div>
  )
}

export type HeroItem = { icon: React.ReactNode; label: string; sub?: string }

export function AuthHero({
  chip,
  title,
  subtitle,
  items,
  children,
}: {
  chip?: string
  title: React.ReactNode
  subtitle: string
  items?: HeroItem[]
  children?: React.ReactNode
}) {
  return (
    <div style={{
      position: 'relative',
      flex: 1,
      minWidth: 0,
      padding: '48px 56px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      borderRadius: 24,
      overflow: 'hidden',
      background: `
        radial-gradient(ellipse 45% 35% at 50% 22%, rgba(232,204,143,0.16), transparent 60%),
        radial-gradient(ellipse 70% 55% at 50% 30%, rgba(184,201,185,0.14), transparent 65%),
        linear-gradient(180deg, #33483A 0%, #2A3D2E 100%)
      `,
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 20px 50px rgba(42,61,46,0.28)',
    }}>
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Stars count={36} seed={7} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 360 }}>
        <div style={{ marginBottom: 28 }}>
          <AuthBrand />
        </div>

        {chip && (
          <div style={{ marginBottom: 14 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 999,
              border: '1px solid rgba(232,204,143,0.35)',
              background: 'rgba(232,204,143,0.12)',
              color: '#F0DCAC', fontSize: 12, fontWeight: 500, letterSpacing: 0.2,
            }}>
              {chip}
            </span>
          </div>
        )}

        <h2 style={{
          fontFamily: "'Satoshi','Inter',sans-serif",
          fontWeight: 700,
          fontSize: 38,
          lineHeight: 1.06,
          letterSpacing: -1.4,
          margin: '0 0 12px',
          color: '#F5F4EE',
        }}>
          {title}
        </h2>

        <p style={{ color: 'rgba(245,244,238,0.75)', fontSize: 14, lineHeight: 1.6, margin: '0 auto 32px', maxWidth: 300 }}>
          {subtitle}
        </p>

        {children}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320, margin: '0 auto' }}>
          {(items ?? []).map((it, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 14px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.14)',
              textAlign: 'left',
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: 9,
                background: 'rgba(232,204,143,0.18)',
                color: '#E8CC8F',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {it.icon}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, color: '#F5F4EE', fontWeight: 600, letterSpacing: -0.1 }}>{it.label}</span>
                {it.sub && <span style={{ fontSize: 12, color: 'rgba(245,244,238,0.65)', lineHeight: 1.4 }}>{it.sub}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
