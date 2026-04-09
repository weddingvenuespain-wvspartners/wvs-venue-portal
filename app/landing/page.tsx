'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Clock, CalendarX2, FileText, Users, Calendar, FileCheck,
  Check, X, ChevronRight, Menu, X as XIcon,
} from 'lucide-react'
import { BASIC_FALLBACK, PREMIUM_FALLBACK, type PlanFeatures } from '@/lib/use-plan-features'
import type { BillingCycle } from '@/lib/billing-types'

// ── Types ────────────────────────────────────────────────────────────────────

type Plan = {
  id: string
  name: string
  display_name: string | null
  description: string | null
  billing_cycles: BillingCycle[]
  is_active: boolean
  visible_on_web: boolean
}

// ── Feature labels for pricing cards ─────────────────────────────────────────

const FEATURE_LABELS: { key: keyof PlanFeatures; label: string }[] = [
  { key: 'ficha', label: 'Ficha del venue' },
  { key: 'leads', label: 'Gestión de leads' },
  { key: 'leads_date_filter', label: 'Filtrar leads por fecha' },
  { key: 'leads_export', label: 'Exportar leads a CSV' },
  { key: 'calendario', label: 'Calendario de disponibilidad' },
  { key: 'propuestas', label: 'Propuestas digitales' },
  { key: 'propuestas_web', label: 'Web de propuesta pública' },
  { key: 'comunicacion', label: 'Comunicación y tarifas' },
  { key: 'estadisticas', label: 'Estadísticas y métricas' },
]

// ── Hero images (Unsplash stable URLs) ──────────────────────────────────────

const HERO_IMG = 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1920&q=80&auto=format'
const FEATURE_IMGS = [
  'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&q=80&auto=format', // wedding venue outdoor
  'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&q=80&auto=format', // elegant table setup
  'https://images.unsplash.com/photo-1507504031003-b417219a0fde?w=800&q=80&auto=format', // wedding ceremony
]

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  gold: '#C4975A',
  charcoal: '#2C2825',
  cream: '#F7F3EE',
  ivory: '#EFE9E0',
  warmGray: '#8A7F76',
  espresso: '#1A1512',
  goldLight: '#E8D4B0',
} as const

// ── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [plans, setPlans] = useState<Plan[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [billingAnnual, setBillingAnnual] = useState(true)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then((data: Plan[]) => {
        const sorted = [...data].sort((a, b) => {
          const aPremium = a.name.toLowerCase().includes('premium') ? 1 : 0
          const bPremium = b.name.toLowerCase().includes('premium') ? 1 : 0
          return aPremium - bPremium
        })
        setPlans(sorted)
      })
      .catch(() => {})
  }, [])

  const scrollTo = (id: string) => {
    setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ fontFamily: 'Manrope, sans-serif', color: C.charcoal, background: '#fff' }}>

      {/* ═══════ STICKY TOP BAR ═══════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '0 24px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        transition: 'all 0.3s',
      }}>
        <div style={{ color: C.gold, fontWeight: 500, fontSize: 15, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
          Wedding Venues Spain
        </div>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: 'flex', gap: 32 }}>
            {[
              { label: 'Funcionalidades', id: 'funcionalidades' },
              { label: 'Planes', id: 'planes' },
              { label: 'Contacto', id: 'contacto' },
            ].map(link => (
              <button key={link.id} onClick={() => scrollTo(link.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 500,
                color: scrolled ? C.charcoal : 'rgba(255,255,255,0.7)',
                transition: 'color 0.3s', padding: '4px 0',
              }}>
                {link.label}
              </button>
            ))}
          </nav>
        )}

        {/* Desktop auth buttons */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{
              textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
              fontSize: 13, fontWeight: 500,
              color: scrolled ? C.charcoal : '#fff',
              border: `1px solid ${scrolled ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.25)'}`,
              borderRadius: 8, padding: '8px 18px', transition: 'all 0.3s',
            }}>
              Iniciar sesión
            </Link>
            <Link href="/pricing" style={{
              textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
              fontSize: 13, fontWeight: 500, color: '#fff',
              background: C.gold, borderRadius: 8, padding: '8px 18px',
            }}>
              Empezar ahora
            </Link>
          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button onClick={() => setMobileMenu(!mobileMenu)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            color: scrolled ? C.charcoal : '#fff',
          }}>
            {mobileMenu ? <XIcon size={24} /> : <Menu size={24} />}
          </button>
        )}
      </header>

      {/* Mobile menu overlay */}
      {isMobile && mobileMenu && (
        <div style={{
          position: 'fixed', top: 64, left: 0, right: 0, bottom: 0, zIndex: 999,
          background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(20px)',
          display: 'flex', flexDirection: 'column', padding: '32px 24px', gap: 8,
        }}>
          {['Funcionalidades', 'Planes', 'Contacto'].map(label => (
            <button key={label} onClick={() => scrollTo(label.toLowerCase())} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 500,
              color: C.charcoal, padding: '12px 0', textAlign: 'left',
            }}>
              {label}
            </button>
          ))}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link href="/login" onClick={() => setMobileMenu(false)} style={{
              textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
              fontSize: 15, fontWeight: 500, color: C.charcoal, textAlign: 'center',
              border: `1px solid ${C.ivory}`, borderRadius: 8, padding: '12px 0',
            }}>
              Iniciar sesión
            </Link>
            <Link href="/pricing" onClick={() => setMobileMenu(false)} style={{
              textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
              fontSize: 15, fontWeight: 500, color: '#fff', textAlign: 'center',
              background: C.gold, borderRadius: 8, padding: '12px 0',
            }}>
              Empezar ahora
            </Link>
          </div>
        </div>
      )}

      {/* ═══════ HERO SECTION ═══════ */}
      <section style={{
        minHeight: '100vh', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: isMobile ? '120px 24px 80px' : '80px 24px', textAlign: 'center',
      }}>
        {/* Background image + overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${HERO_IMG})`,
          backgroundSize: 'cover', backgroundPosition: 'center 40%',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(26,21,18,0.75) 0%, rgba(26,21,18,0.85) 50%, rgba(26,21,18,0.95) 100%)',
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: isMobile ? 'clamp(32px, 9vw, 44px)' : 'clamp(36px, 5vw, 56px)',
            fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            Tu venue merece<br />más bodas
          </h1>

          <p style={{
            fontSize: isMobile ? 15 : 18, color: 'rgba(255,255,255,0.6)',
            maxWidth: 520, lineHeight: 1.7, marginTop: 20, padding: '0 8px',
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            La plataforma que conecta espacios únicos con parejas que buscan el lugar perfecto.
            Gestiona leads, propuestas y calendario desde un solo sitio.
          </p>

          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: 14, marginTop: 32, alignItems: 'center', justifyContent: 'center',
          }}>
            <Link href="/pricing" style={{
              textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
              fontSize: 16, fontWeight: 500, color: '#fff', background: C.gold,
              padding: '14px 32px', borderRadius: 8, display: 'inline-flex',
              alignItems: 'center', gap: 8,
            }}>
              Empieza ahora <ChevronRight size={16} />
            </Link>
            <button onClick={() => scrollTo('funcionalidades')} style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 500,
              color: '#fff', background: 'transparent', padding: '14px 32px',
              borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
            }}>
              Ver cómo funciona
            </button>
          </div>

          <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 24 : 48, marginTop: 48, alignItems: 'center', justifyContent: 'center',
          }}>
            {[
              { value: '200+', label: 'venues activos' },
              { value: '1.500+', label: 'bodas gestionadas' },
              { value: 'ES & PT', label: 'cobertura' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontSize: 26, fontWeight: 600 }}>{stat.value}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PROBLEMS SECTION ═══════ */}
      <section style={{ background: C.cream, padding: isMobile ? '72px 20px' : '100px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 600, color: C.charcoal, margin: 0 }}>
            Los problemas que resolvemos
          </h2>
          <p style={{ fontSize: 15, color: C.warmGray, maxWidth: 460, margin: '14px auto 0', lineHeight: 1.7 }}>
            Sabemos lo que es gestionar un venue. Por eso creamos la herramienta que nos hubiera gustado tener.
          </p>

          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 20, marginTop: 44,
          }}>
            {[
              { icon: Clock, title: '¿Pierdes leads por no responder a tiempo?', desc: 'Recibe y gestiona todas las consultas en un solo panel. Responde en minutos, no en días.' },
              { icon: CalendarX2, title: '¿Tu calendario es un caos de Excel?', desc: 'Visualiza disponibilidad, bloquea fechas y evita dobles reservas automáticamente.' },
              { icon: FileText, title: '¿Envías presupuestos por email?', desc: 'Crea propuestas digitales profesionales que tus clientes pueden aceptar online.' },
            ].map((card, i) => {
              const Icon = card.icon
              return (
                <div key={i} style={{
                  background: '#fff', borderRadius: 12, padding: isMobile ? 24 : 32,
                  border: `1px solid ${C.ivory}`, textAlign: 'center',
                }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', background: 'rgba(196,151,90,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto',
                  }}>
                    <Icon size={22} color={C.gold} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.charcoal, marginTop: 18, lineHeight: 1.4 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 14, color: C.warmGray, lineHeight: 1.7, marginTop: 8 }}>
                    {card.desc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES SECTION ═══════ */}
      <section id="funcionalidades" style={{ background: '#fff', padding: isMobile ? '72px 20px' : '100px 20px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 600, color: C.charcoal, margin: 0, textAlign: 'center' }}>
            Todo lo que necesitas en un solo lugar
          </h2>

          {[
            { reversed: false, label: 'LEADS', icon: Users, img: FEATURE_IMGS[0], title: 'Gestión de leads inteligente', desc: 'Todas las consultas de tu venue centralizadas en un panel inteligente. Filtra por fecha, estado y origen.', bullets: ['Panel centralizado', 'Filtros avanzados', 'Respuesta rápida'] },
            { reversed: true, label: 'CALENDARIO', icon: Calendar, img: FEATURE_IMGS[1], title: 'Calendario de disponibilidad', desc: 'Tu disponibilidad siempre actualizada. Tus clientes ven las fechas libres sin que tengas que hacer nada.', bullets: ['Vista mensual', 'Bloqueo de fechas', 'Sin dobles reservas'] },
            { reversed: false, label: 'PROPUESTAS', icon: FileCheck, img: FEATURE_IMGS[2], title: 'Propuestas que impresionan', desc: 'Crea presupuestos digitales personalizados con tu imagen de marca. Tus clientes los reciben y aceptan online.', bullets: ['Diseño profesional', 'Envío por enlace', 'Aceptación online'] },
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', flexDirection: isMobile ? 'column' : (f.reversed ? 'row-reverse' : 'row'),
              gap: isMobile ? 28 : 60, maxWidth: 1000, margin: '0 auto',
              padding: isMobile ? '36px 0' : '48px 0', alignItems: 'center',
            }}>
              {/* Text */}
              <div style={{ flex: 1 }}>
                <div style={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.12em', color: C.gold, fontWeight: 600, marginBottom: 10 }}>
                  {f.label}
                </div>
                <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 600, color: C.charcoal, lineHeight: 1.3 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 15, color: C.warmGray, lineHeight: 1.7, marginTop: 10 }}>
                  {f.desc}
                </div>
                <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {f.bullets.map(b => (
                    <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', background: 'rgba(196,151,90,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Check size={11} color={C.gold} strokeWidth={2.5} />
                      </div>
                      <span style={{ fontSize: 14, color: C.charcoal, fontWeight: 500 }}>{b}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Image */}
              <div style={{
                flex: 1, borderRadius: 14, height: isMobile ? 220 : 300, width: '100%',
                backgroundImage: `url(${f.img})`, backgroundSize: 'cover', backgroundPosition: 'center',
                boxShadow: '0 16px 48px rgba(44,40,37,0.12)',
              }} />
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ PRICING SECTION ═══════ */}
      <section id="planes" style={{ background: C.cream, padding: isMobile ? '72px 20px' : '100px 20px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 600, color: C.charcoal, margin: 0 }}>
            Planes simples, sin sorpresas
          </h2>
          <p style={{ fontSize: 15, color: C.warmGray, margin: '12px auto 0' }}>
            Elige el plan que mejor se adapte a tu venue
          </p>

          {/* Trial banner */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20,
            background: 'rgba(196,151,90,0.1)', borderRadius: 20, padding: '6px 16px',
            fontSize: 13, color: C.gold, fontWeight: 500,
          }}>
            <Check size={14} /> Prueba gratis 30 días — sin compromiso
          </div>

          {/* Billing toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, marginTop: 28,
          }}>
            <span style={{ fontSize: 14, fontWeight: billingAnnual ? 400 : 600, color: billingAnnual ? C.warmGray : C.charcoal }}>
              Mensual
            </span>
            <button onClick={() => setBillingAnnual(!billingAnnual)} style={{
              width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: billingAnnual ? C.gold : C.ivory, position: 'relative', transition: 'background 0.2s',
              padding: 0,
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 3,
                left: billingAnnual ? 25 : 3,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }} />
            </button>
            <span style={{ fontSize: 14, fontWeight: billingAnnual ? 600 : 400, color: billingAnnual ? C.charcoal : C.warmGray }}>
              Anual
            </span>
            {billingAnnual && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#16a34a', background: 'rgba(22,163,74,0.08)',
                padding: '3px 8px', borderRadius: 4,
              }}>
                Ahorra 2 meses
              </span>
            )}
          </div>

          {/* Plan cards */}
          {plans.length > 0 && (
            <div style={{
              display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: 24, marginTop: 36,
            }}>
              {plans.map(plan => {
                const isPremium = plan.name.toLowerCase().includes('premium')
                const features: PlanFeatures = isPremium ? PREMIUM_FALLBACK : BASIC_FALLBACK
                const cycle = plan.billing_cycles.find((c: BillingCycle) =>
                  billingAnnual ? c.interval_months === 12 : c.interval_months === 1
                ) || plan.billing_cycles[0]

                const sortedFeatures = [...FEATURE_LABELS].sort((a, b) => {
                  return (features[a.key] ? 0 : 1) - (features[b.key] ? 0 : 1)
                })

                return (
                  <div key={plan.id} style={{
                    background: '#fff', borderRadius: 14, padding: '32px 28px',
                    border: isPremium ? `2px solid ${C.gold}` : `1px solid ${C.ivory}`,
                    position: 'relative', textAlign: 'left',
                    boxShadow: isPremium ? '0 8px 32px rgba(196,151,90,0.1)' : undefined,
                  }}>
                    {isPremium && (
                      <div style={{
                        position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
                        background: C.gold, color: '#fff', fontSize: 10, fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        padding: '4px 14px', borderRadius: '0 0 8px 8px',
                      }}>
                        Recomendado
                      </div>
                    )}

                    <div style={{ fontSize: 20, fontWeight: 600, color: C.charcoal, marginTop: isPremium ? 10 : 0 }}>
                      {plan.display_name || plan.name}
                    </div>

                    {plan.description && (
                      <div style={{ fontSize: 13, color: C.warmGray, marginTop: 4, lineHeight: 1.5 }}>
                        {plan.description}
                      </div>
                    )}

                    {/* Price */}
                    <div style={{ marginTop: 20, paddingBottom: 20, borderBottom: `1px solid ${C.ivory}` }}>
                      <span style={{ fontSize: 36, fontWeight: 700, color: C.charcoal }}>
                        {cycle?.price || 0}€
                      </span>
                      <span style={{ fontSize: 14, color: C.warmGray, marginLeft: 4 }}>
                        /{billingAnnual ? 'año' : 'mes'}
                      </span>
                      {billingAnnual && cycle && (
                        <div style={{ fontSize: 12, color: C.warmGray, marginTop: 4 }}>
                          {Math.round(cycle.price / 12)}€/mes facturado anualmente
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <div style={{ marginTop: 20 }}>
                      {sortedFeatures.map(f => {
                        const included = features[f.key]
                        return (
                          <div key={f.key} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '5px 0', opacity: included ? 1 : 0.4,
                          }}>
                            {included
                              ? <Check size={15} color={C.gold} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                              : <X size={15} color={C.warmGray} strokeWidth={2} style={{ flexShrink: 0 }} />
                            }
                            <span style={{ fontSize: 13, color: included ? C.charcoal : C.warmGray }}>
                              {f.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>

                    {/* CTA */}
                    <Link href="/pricing" style={{
                      display: 'block', textAlign: 'center', textDecoration: 'none',
                      fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 500,
                      color: '#fff', background: isPremium ? C.gold : C.charcoal,
                      padding: '12px 0', borderRadius: 8, marginTop: 24,
                    }}>
                      Empezar ahora
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section style={{
        background: `radial-gradient(ellipse at 50% 0%, rgba(196,151,90,0.12) 0%, transparent 60%), ${C.espresso}`,
        padding: isMobile ? '72px 20px' : '100px 20px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: isMobile ? 26 : 36, fontWeight: 600, color: '#fff', margin: 0 }}>
          ¿Listo para transformar tu venue?
        </h2>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 460, margin: '14px auto 0', lineHeight: 1.7 }}>
          Únete a cientos de venues que ya gestionan sus bodas de forma profesional.
        </p>
        <div style={{ marginTop: 28 }}>
          <Link href="/pricing" style={{
            textDecoration: 'none', fontFamily: 'Manrope, sans-serif',
            fontSize: 16, fontWeight: 500, color: '#fff', background: C.gold,
            padding: '14px 32px', borderRadius: 8, display: 'inline-flex',
            alignItems: 'center', gap: 8,
          }}>
            Crear cuenta gratis <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer id="contacto" style={{
        background: C.espresso, padding: '48px 20px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          maxWidth: 1000, margin: '0 auto',
          display: 'flex', flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
          gap: isMobile ? 24 : 0,
        }}>
          <div>
            <div style={{ color: C.gold, fontSize: 15, fontWeight: 500, letterSpacing: '0.06em' }}>
              Wedding Venues Spain
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, marginTop: 4 }}>
              La plataforma de gestión para venues de bodas
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <Link href="/cookies" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
              Cookies
            </Link>
            <Link href="/privacidad" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
              Privacidad
            </Link>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            info@weddingvenuesspain.com
          </div>
        </div>
        <div style={{
          maxWidth: 1000, margin: '28px auto 0', paddingTop: 20,
          borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            © 2026 Wedding Venues Spain. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
