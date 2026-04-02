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
  const txt     = dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.55)'
  const border  = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.1)'
  const cardBg  = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)'
  const cardHov = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'
  const headCol = dark ? '#fff' : '#111'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 2 }}>
      {/* ① Agendar visita — primario */}
      <div style={{ background: primary, padding: '40px 36px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: '2rem', lineHeight: 1 }}>🏛️</div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: onPrimary, marginTop: 4 }}>Agendar una visita</div>
        <p style={{ fontSize: '.84rem', color: onPrimary, opacity: .8, lineHeight: 1.7, flex: 1 }}>
          La mayoría de nuestras parejas toman la decisión durante la primera visita al espacio. ¿Cuándo os vendría bien?
        </p>
        <button
          onClick={() => document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' })}
          style={{ background: dark ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.25)', border: 'none', color: onPrimary, padding: '12px 20px', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4 }}>
          Reservar visita →
        </button>
      </div>
      {/* ② WhatsApp/Chat */}
      <div
        style={{ background: cardBg, border: `1px solid ${border}`, padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'background .2s', cursor: waLink || mailTo ? 'pointer' : 'default' }}
        onClick={() => (waLink || mailTo) && window.open(waLink || mailTo!, '_blank')}
        onMouseEnter={e => (e.currentTarget.style.background = cardHov)}
        onMouseLeave={e => (e.currentTarget.style.background = cardBg)}
      >
        <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>💬</div>
        <div style={{ fontSize: '.98rem', fontWeight: 700, color: headCol, marginTop: 4 }}>Hablar con nosotros</div>
        <p style={{ fontSize: '.82rem', color: txt, lineHeight: 1.65, flex: 1 }}>
          ¿Tenéis dudas? Nuestro equipo os responde por WhatsApp en minutos.
        </p>
        {(waLink || mailTo) && (
          <a href={waLink || mailTo!} target="_blank" rel="noopener"
            style={{ fontSize: '.75rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: primary, textDecoration: 'none', marginTop: 4 }}
            onClick={e => e.stopPropagation()}>
            {waLink ? 'Abrir WhatsApp →' : 'Enviar email →'}
          </a>
        )}
      </div>
      {/* ③ Reservar fecha */}
      <div
        style={{ background: cardBg, border: `1px solid ${border}`, padding: '36px 28px', display: 'flex', flexDirection: 'column', gap: 10, transition: 'background .2s', cursor: 'pointer' }}
        onClick={() => document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' })}
        onMouseEnter={e => (e.currentTarget.style.background = cardHov)}
        onMouseLeave={e => (e.currentTarget.style.background = cardBg)}
      >
        <div style={{ fontSize: '1.8rem', lineHeight: 1 }}>🗓️</div>
        <div style={{ fontSize: '.98rem', fontWeight: 700, color: headCol, marginTop: 4 }}>Reservar fecha</div>
        <p style={{ fontSize: '.82rem', color: txt, lineHeight: 1.65, flex: 1 }}>
          Si ya lo tenéis claro, podéis reservar vuestra fecha directamente.
        </p>
        <button
          onClick={() => document.getElementById(ctaId)?.scrollIntoView({ behavior: 'smooth' })}
          style={{ background: 'none', border: `1px solid ${border}`, color: headCol, padding: '9px 16px', fontSize: '.73rem', fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', cursor: 'pointer', alignSelf: 'flex-start', marginTop: 4, transition: 'border-color .2s' }}>
          Confirmar reserva →
        </button>
      </div>
    </div>
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
            <span style={{ fontSize: '1.1rem' }}>💬</span> WhatsApp
          </a>
          {phone && (
            <a href={`tel:${phone}`}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#f0f0f0', borderRadius: 8, textDecoration: 'none', color: '#111', fontSize: '.82rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.1rem' }}>📞</span> Llamar
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
        {open ? '✕' : '💬'}
      </button>
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
