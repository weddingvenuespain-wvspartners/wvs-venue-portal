'use client'
import { Lock, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { usePlanFeatures, type PlanFeatures } from '@/lib/use-plan-features'

type Props = {
  feature:     keyof PlanFeatures
  title:       string
  description: string
  icon?:       LucideIcon
  children?:   ReactNode
}

/**
 * Premium feature gate. While auth is loading, renders a neutral loader
 * (avoids the flicker where premium users briefly see the lock screen).
 * If the feature is missing, renders the lock screen.
 *
 * Two usage modes:
 *   1. Wrapper:   <FeatureGate ...>{actualContent}</FeatureGate>
 *   2. Early-return gate, returns null when the feature is allowed:
 *        if (features.loading || !features.X) return <FeatureGate ... />
 */
export default function FeatureGate({ feature, title, description, icon: Icon = Lock, children }: Props) {
  const features = usePlanFeatures()

  if (features.loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ color: 'var(--warm-gray)', fontSize: 13 }}>Cargando…</div>
        </main>
      </div>
    )
  }

  if (!features[feature]) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--cream)' }}>
        <Sidebar />
        <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--gold)' }}>
              <Icon size={32} strokeWidth={1.5} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--espresso)', fontFamily: 'Inter, sans-serif', marginBottom: 10 }}>{title}</div>
            <div style={{ fontSize: 14, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 24 }}>{description}</div>
            <a href="/perfil" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--gold)', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
              Actualizar plan →
            </a>
          </div>
        </main>
      </div>
    )
  }

  return children !== undefined ? <>{children}</> : null
}
