'use client'
// Shared utilities for all proposal templates

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
export type { ProposalData }

// ─── Types ─────────────────────────────────────────────────────────────────────
export type SectionsData = {
  video_url?: string; video_title?: string
  show_chat?: boolean; chat_intro?: string
  show_nextsteps?: boolean
  nextsteps?: Array<{ title: string; description: string }>
  show_availability_msg?: boolean; availability_message?: string
  sections_enabled?: Record<string, boolean>
  packages_override?:       Array<{ name: string; subtitle?: string; price?: string; description?: string; includes?: string[]; is_recommended?: boolean; min_guests?: number; max_guests?: number; is_active?: boolean }> | null
  zones_override?:          Array<{ name: string; description?: string; capacity_min?: number; capacity_max?: number; price?: string; photos?: string[] }> | null
  season_prices_override?:  Array<{ label?: string; season?: string; date_range?: string; price_modifier?: string; notes?: string }> | null
  inclusions_override?:     Array<{ title: string; emoji?: string; description?: string }> | null
  faq_override?:            Array<{ question: string; answer: string }> | null
  collaborators_override?:  Array<{ name: string; category: string; description?: string; website?: string }> | null
  extra_services_override?: Array<{ name: string; price?: string; description?: string }> | null
  menu_prices_override?:    Array<{ name: string; price_per_person: string; description?: string; min_guests?: number }> | null
  experience_override?:     { title: string; body: string } | null
  testimonials_override?:   Array<{ couple_name?: string; names?: string; wedding_date?: string; date?: string; text: string; rating?: number; photo_url?: string }> | null
  // Per-proposal image overrides
  hero_image_url?: string
  gallery_urls?: string[]
  // Visual template selection (1–5)
  visual_template_id?: number
  // Legacy fields used by propuestas/page.tsx
  show_timeline?: boolean; timeline_intro?: string
  timeline?: Array<{ time: string; title: string; description?: string }>
  show_testimonials?: boolean
  testimonials?: Array<{ names: string; couple_name?: string; date?: string; wedding_date?: string; guests?: number; text: string; rating?: number; photo_url?: string }>
  show_map?: boolean; map_embed_url?: string; map_address?: string; map_notes?: string
  show_techspecs?: boolean
  techspecs?: { sqm?: string; ceiling?: string; parking?: string; accessibility?: string; ceremony_spaces?: string; extra?: string }
  show_accommodation?: boolean
  accommodation?: { rooms?: string; description?: string; price_info?: string; nearby?: string }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
export function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
export function formatPrice(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}
export function isDark(hex: string) {
  const c = hex.replace('#', '')
  if (c.length < 6) return true
  return (parseInt(c.slice(0,2),16)*299 + parseInt(c.slice(2,4),16)*587 + parseInt(c.slice(4,6),16)*114) / 1000 < 128
}
export function toRgb(hex: string) {
  const c = hex.replace('#','')
  if (c.length < 6) return '20,20,20'
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`
}
export function getEmbedUrl(url: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const v = url.match(/vimeo\.com\/(\d+)/)
  if (v) return `https://player.vimeo.com/video/${v[1]}?title=0&byline=0&portrait=0`
  return null
}

// ─── Reveal hook ───────────────────────────────────────────────────────────────
export function useReveal(threshold = 0.07) {
  const ref = useRef<HTMLDivElement>(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect() } }, { threshold })
    io.observe(el); return () => io.disconnect()
  }, [threshold])
  return { ref, vis }
}

export function FadeUp({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, vis } = useReveal()
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(28px)', transition: `opacity .7s ${delay}s cubic-bezier(.22,1,.36,1),transform .7s ${delay}s cubic-bezier(.22,1,.36,1)`, ...style }}>
      {children}
    </div>
  )
}

export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, vis } = useReveal()
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transition: `opacity 1s ${delay}s ease` }}>
      {children}
    </div>
  )
}

// ─── Inline SVG icons (replace emojis for consistent rendering) ───────────────
const SVG = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" {...p} />
)
export function IcoBuilding(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><rect x="3" y="2" width="18" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/></SVG>
}
export function IcoCalendar(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></SVG>
}
export function IcoChat(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></SVG>
}
export function IcoPhone(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.63 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></SVG>
}
export function IcoPin(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></SVG>
}
export function IcoUsers(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></SVG>
}
export function IcoX(p: React.SVGProps<SVGSVGElement>) {
  return <SVG {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></SVG>
}

// ─── Conversion Block — 3 CTAs: visita / chat / reservar ──────────────────────
export function ConversionBlock({
  data, primary, onPrimary, dark = true, ctaId = 'cta',
}: {
  data: ProposalData
  primary: string
  onPrimary: string
  dark?: boolean
  ctaId?: string
}) {
  const phone   = data.venue?.contact_phone || ''
  const waMsg   = encodeURIComponent(`Hola 👋 acabo de ver la propuesta para ${data.couple_name} y me gustaría hablar con vosotros.`)
  const waLink  = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${waMsg}` : null
  const mailTo  = data.venue?.contact_email ? `mailto:${data.venue.contact_email}` : null
  const txt      = dark ? 'rgba(255,255,255,.55)' : '#64748b'
  const cardBg   = dark ? 'rgba(255,255,255,.05)' : '#ffffff'
  const cardHov  = dark ? 'rgba(255,255,255,.09)' : '#f8f8f8'
  const cardBord = dark ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.09)'
  const headCol  = dark ? '#fff' : '#111'
  const secBg    = dark ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.03)'
  const shadow   = dark ? 'none' : '0 2px 16px rgba(0,0,0,.07)'
  const iconBg   = dark ? 'rgba(255,255,255,.06)' : `rgba(${toRgb(primary)},.1)`

  return (
    <section style={{ background: secBg, padding: '56px 32px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: '.6rem', fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: primary }}>
            ¿Qué queréis hacer ahora?
          </span>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

          {/* ① Agendar visita — accent card */}
          <div style={{ background: primary, borderRadius: 16, flex: '1.15 1 260px', padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(0,0,0,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IcoBuilding width={22} height={22} style={{ color: onPrimary }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: onPrimary, marginBottom: 6 }}>Agendar una visita</div>
              <p style={{ fontSize: '.82rem', color: onPrimary, opacity: .78, lineHeight: 1.7, margin: 0 }}>
                La mayoría de parejas toman la decisión durante la primera visita. ¿Cuándo os vendría bien?
              </p>
            </div>
            <button
              onClick={() => document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' })}
              style={{ marginTop: 'auto', background: 'rgba(0,0,0,.22)', border: '1px solid rgba(255,255,255,.25)', color: onPrimary, padding: '11px 20px', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8, alignSelf: 'flex-start' }}>
              Reservar visita →
            </button>
          </div>

          {/* ② WhatsApp/Chat */}
          <div
            style={{ background: cardBg, border: `1px solid ${cardBord}`, borderRadius: 16, boxShadow: shadow, flex: '1 1 220px', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'background .2s', cursor: waLink || mailTo ? 'pointer' : 'default' }}
            onClick={() => (waLink || mailTo) && window.open(waLink || mailTo!, '_blank')}
            onMouseEnter={e => (e.currentTarget.style.background = cardHov)}
            onMouseLeave={e => (e.currentTarget.style.background = cardBg)}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IcoChat width={22} height={22} style={{ color: primary }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: headCol, marginBottom: 6 }}>Hablar con nosotros</div>
              <p style={{ fontSize: '.82rem', color: txt, lineHeight: 1.65, margin: 0 }}>
                ¿Tenéis dudas? Nuestro equipo os responde por WhatsApp en minutos.
              </p>
            </div>
            {(waLink || mailTo) && (
              <a href={waLink || mailTo!} target="_blank" rel="noopener"
                style={{ marginTop: 'auto', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: primary, textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}>
                {waLink ? 'Abrir WhatsApp →' : 'Enviar email →'}
              </a>
            )}
          </div>

          {/* ③ Reservar fecha */}
          <div
            style={{ background: cardBg, border: `1px solid ${cardBord}`, borderRadius: 16, boxShadow: shadow, flex: '1 1 220px', padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 14, transition: 'background .2s', cursor: 'pointer' }}
            onClick={() => document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' })}
            onMouseEnter={e => (e.currentTarget.style.background = cardHov)}
            onMouseLeave={e => (e.currentTarget.style.background = cardBg)}
          >
            <div style={{ width: 44, height: 44, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IcoCalendar width={22} height={22} style={{ color: primary }} />
            </div>
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: headCol, marginBottom: 6 }}>Reservar fecha</div>
              <p style={{ fontSize: '.82rem', color: txt, lineHeight: 1.65, margin: 0 }}>
                Si ya lo tenéis claro, podéis reservar vuestra fecha directamente.
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' }) }}
              style={{ marginTop: 'auto', background: 'none', border: `1px solid ${cardBord}`, color: headCol, padding: '10px 16px', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 8, alignSelf: 'flex-start' }}>
              Confirmar reserva →
            </button>
          </div>

        </div>
      </div>
    </section>
  )
}

// ─── Floating WhatsApp button ─────────────────────────────────────────────────
export function FloatingWhatsApp({ phone, coupleName, primary, onPrimary }: {
  phone: string; coupleName: string; primary: string; onPrimary: string
}) {
  const [open, setOpen]       = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  if (!phone) return null
  const waMsg  = encodeURIComponent(`Hola 👋 he visto la propuesta para ${coupleName} y me gustaría hablar con vosotros.`)
  const waLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=${waMsg}`

  return (
    <div style={{
      position: 'fixed', bottom: 88, right: 20, zIndex: 9000,
      opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)',
      transition: 'opacity .3s, transform .3s',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 12px)', right: 0,
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)',
          width: 220, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#111', marginBottom: 2 }}>¿Cómo preferís que os contactemos?</div>
          <a href={waLink} target="_blank" rel="noopener"
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#25D366', borderRadius: 8, textDecoration: 'none', color: '#fff', fontSize: '.82rem', fontWeight: 600 }}>
            <IcoChat width={16} height={16} style={{ color: '#fff', flexShrink: 0 }} /> WhatsApp
          </a>
          {phone && (
            <a href={`tel:${phone}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f0f0', borderRadius: 8, textDecoration: 'none', color: '#111', fontSize: '.82rem', fontWeight: 600 }}>
              <IcoPhone width={16} height={16} style={{ color: '#111', flexShrink: 0 }} /> Llamar
            </a>
          )}
          <div style={{ fontSize: '.68rem', color: '#999', textAlign: 'center', marginTop: 2 }}>Respondemos en menos de 2h</div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#25D366', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', boxShadow: '0 4px 20px rgba(37,211,102,.5)',
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 28px rgba(37,211,102,.6)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(37,211,102,.5)' }}
      >
        {open
          ? <IcoX width={20} height={20} style={{ color: '#fff' }} />
          : <IcoChat width={24} height={24} style={{ color: '#fff' }} />
        }
      </button>
    </div>
  )
}

// ─── Gallery — 1-3 images: equal grid · 4+ images: auto-carousel ─────────────
export function Gallery({
  photos, primary, dark = true,
}: {
  photos: string[]
  primary: string
  dark?: boolean
}) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = photos.length
  const VISIBLE = 4
  const maxIdx = Math.max(0, n - VISIBLE)
  const canSlide = n > VISIBLE

  useEffect(() => {
    if (!canSlide || paused) return
    const t = setInterval(() => setIdx(i => (i >= maxIdx ? 0 : i + 1)), 3500)
    return () => clearInterval(t)
  }, [canSlide, paused, maxIdx])

  if (!n) return null

  // 1–3 images → same-height equal grid
  if (n <= 3) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 3 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ overflow: 'hidden', aspectRatio: n === 1 ? '21/9' : '4/2' }}>
            <img src={url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .7s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            />
          </div>
        ))}
      </div>
    )
  }

  // 4+ images → sliding strip, 4 visible, advances 1 at a time
  // translateX% is relative to the strip's own width (n × 25% of parent),
  // so each step of 100/n % moves exactly one image (25% of parent)
  return (
    <div
      style={{ position: 'relative', overflow: 'hidden', userSelect: 'none' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        display: 'flex',
        transform: `translateX(-${(idx * 100 / n).toFixed(4)}%)`,
        transition: 'transform .55s cubic-bezier(.22,1,.36,1)',
      }}>
        {photos.map((url, i) => (
          <div key={i} style={{ flex: '0 0 25%', height: 240, overflow: 'hidden', padding: '0 1.5px' }}>
            <img src={url} alt="" loading={i < 5 ? 'eager' : 'lazy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .7s ease' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={e => (e.currentTarget.style.transform = '')}
            />
          </div>
        ))}
      </div>

      {idx > 0 && (
        <button onClick={() => { setPaused(true); setIdx(i => Math.max(0, i - 1)) }} aria-label="Anterior"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 4, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
      )}
      {idx < maxIdx && (
        <button onClick={() => { setPaused(true); setIdx(i => Math.min(maxIdx, i + 1)) }} aria-label="Siguiente"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 4, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
      )}
    </div>
  )
}

// ─── Availability Banner ───────────────────────────────────────────────────────
export function AvailabilityBanner({ message, primary, onPrimary }: {
  message: string; primary: string; onPrimary: string
}) {
  return (
    <div style={{ background: primary, padding: '12px 48px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: onPrimary, opacity: .7, flexShrink: 0, animation: 'pulse 2s infinite' }} />
      <span style={{ fontSize: '.8rem', fontWeight: 500, color: onPrimary, opacity: .9 }}>{message}</span>
    </div>
  )
}

// ─── Data extraction ───────────────────────────────────────────────────────────
export function extractData(data: ProposalData) {
  const sec: SectionsData = (data as any).sections_data || {}
  const so = sec as any
  const vc = data.venueContent
  return {
    sec,
    on: (id: string) => sec.sections_enabled?.[id] !== false,
    packagesShow:   so.packages_override    != null ? so.packages_override    : vc.packages      ?? [],
    zonesShow:      so.zones_override       != null ? so.zones_override       : vc.zones          ?? [],
    seasonsShow:    so.season_prices_override != null ? so.season_prices_override : vc.season_prices ?? [],
    inclusionsShow: so.inclusions_override  != null ? so.inclusions_override  : vc.inclusions     ?? [],
    faqShow:        so.faq_override         != null ? so.faq_override         : vc.faq            ?? [],
    collabsShow:    so.collaborators_override != null ? so.collaborators_override : vc.collaborators ?? [],
    extrasShow:     so.extra_services_override != null ? so.extra_services_override : vc.extra_services ?? [],
    menuShow:       so.menu_prices_override != null ? so.menu_prices_override : vc.menu_prices    ?? [],
    expShow:        so.experience_override  != null ? so.experience_override  : vc.experience,
    testsShow:      so.testimonials_override != null ? so.testimonials_override : vc.testimonials   ?? [],
    techspecs:      vc.techspecs,
    accom:          vc.accommodation_info,
    mapVC:          vc.map_info,
    budgetSim:      vc.budget_simulator,
  }
}
