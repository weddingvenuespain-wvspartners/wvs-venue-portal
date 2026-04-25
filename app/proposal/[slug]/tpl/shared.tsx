'use client'
// Shared utilities for all proposal templates

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
import type { Menu, MenuExtra, AppetizerGroup, SectionsData } from '@/lib/proposal-types'

export type { ProposalData }
export type { MenuItem, MenuCourse, Menu, MenuExtra, AppetizerGroup, SectionsData } from '@/lib/proposal-types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

const ZONE_CAP_LABELS: Record<string, string> = {
  ceremony: 'Ceremonia', cocktail: 'Coctel', banquet: 'Banquete', party: 'Fiesta', other: '',
}
const ZONE_COVERED_LABELS: Record<string, string> = {
  indoor: 'Interior', outdoor: 'Exterior', 'covered-outdoor': 'Exterior cubierto',
}

export function formatZoneCapacities(z: any): string[] {
  const out: string[] = []
  if (Array.isArray(z?.capacities) && z.capacities.length) {
    z.capacities.forEach((c: any) => {
      if (!c || (!c.count && !c.label)) return
      const typeLabel = c.label || ZONE_CAP_LABELS[c.type] || ''
      if (c.count && typeLabel) out.push(`${typeLabel}: ${c.count} pax`)
      else if (c.count) out.push(`${c.count} pax`)
      else if (typeLabel) out.push(typeLabel)
    })
  } else if (z?.capacity_min || z?.capacity_max) {
    if (z.capacity_min && z.capacity_max) out.push(`${z.capacity_min}–${z.capacity_max} pax`)
    else if (z.capacity_max) out.push(`hasta ${z.capacity_max} pax`)
    else if (z.capacity_min) out.push(`desde ${z.capacity_min} pax`)
  }
  return out
}

export function resolveContact(data: ProposalData) {
  const sec = (data as any).sections_data as SectionsData | undefined
  const override = sec?.contact
  return {
    phone: (override?.phone?.trim() || data.venue?.contact_phone || '').trim(),
    email: (override?.email?.trim() || data.venue?.contact_email || '').trim(),
  }
}

export function ivaLabel(sec: SectionsData | undefined | null, short = false): string {
  if (!sec || sec.iva_included === undefined) return short ? '' : ''
  if (sec.iva_included) return short ? 'IVA incl.' : 'IVA incluido'
  return short ? 'IVA no incl.' : 'IVA no incluido'
}

export function formatZoneFeatures(z: any): string[] {
  const out: string[] = []
  if (z?.sqm) out.push(`${z.sqm} m²`)
  if (z?.climatized) out.push('Climatizado')
  if (z?.plan_b) out.push('Plan B cubierto')
  if (z?.covered && ZONE_COVERED_LABELS[z.covered]) out.push(ZONE_COVERED_LABELS[z.covered])
  return out
}

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

// ─── Icon resolver for inclusions / testimonials (uses lucide-react) ──────────
import {
  Check, Clock, Shield, Wifi, ParkingCircle, Music, Lightbulb, Umbrella,
  Sparkles as SparklesIco, Bed, Utensils, Wine, Heart, CalendarCheck, Accessibility,
  TreePine, Mountain, Users as UsersIco, Key, Speaker, Camera, Moon, Sun, Leaf,
  MapPin as MapPinIco, Phone as PhoneIco, Mail, Building as BuildingIco,
  DoorOpen, Flame, Snowflake, Star, Car, Flower2, HeartHandshake,
  Briefcase, Disc3, GlassWater, PartyPopper, FileCheck, ShieldCheck, Soup,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const INCLUSION_ICONS: Record<string, LucideIcon> = {
  check: Check, clock: Clock, time: Clock, hours: Clock,
  shield: Shield, security: ShieldCheck, 'shield-check': ShieldCheck,
  wifi: Wifi, parking: ParkingCircle, car: Car,
  music: Music, sound: Speaker, speaker: Speaker, dj: Disc3, disco: Disc3, nightclub: Disc3,
  lightbulb: Lightbulb, light: Lightbulb, lighting: Lightbulb,
  umbrella: Umbrella, 'plan-b': Umbrella, planb: Umbrella, rain: Umbrella,
  sparkles: SparklesIco, clean: SparklesIco, cleaning: SparklesIco,
  bed: Bed, bedroom: Bed, suite: Bed, accommodation: Bed,
  utensils: Utensils, food: Utensils, dining: Utensils, kitchen: Utensils,
  wine: Wine, bar: GlassWater, drink: GlassWater, cocktail: GlassWater,
  heart: Heart, love: Heart, 'heart-shake': HeartHandshake, recommend: HeartHandshake,
  calendar: CalendarCheck, date: CalendarCheck, event: CalendarCheck,
  accessibility: Accessibility, adapted: Accessibility,
  tree: TreePine, garden: TreePine, olive: Leaf, leaf: Leaf,
  mountain: Mountain, view: Mountain, outdoor: Mountain,
  users: UsersIco, guests: UsersIco, people: UsersIco, staff: Briefcase,
  key: Key, exclusive: Key, exclusivity: Key,
  camera: Camera, photo: Camera, photography: Camera,
  moon: Moon, night: Moon, 'night-club': Disc3,
  sun: Sun, morning: Sun, day: Sun,
  mappin: MapPinIco, location: MapPinIco, map: MapPinIco,
  phone: PhoneIco, mail: Mail, email: Mail,
  building: BuildingIco, venue: BuildingIco, masia: BuildingIco, finca: BuildingIco,
  door: DoorOpen, access: DoorOpen,
  flame: Flame, fire: Flame, cozy: Flame,
  snowflake: Snowflake, snow: Snowflake, ac: Snowflake, climate: Snowflake, climatized: Snowflake,
  star: Star, rating: Star, premium: Star,
  flower: Flower2, flowers: Flower2, florist: Flower2,
  sgae: FileCheck, license: FileCheck, papers: FileCheck,
  party: PartyPopper, celebration: PartyPopper,
  soup: Soup, menu: Soup, 'menu-special': Soup,
}

// List of icon names useful for inclusion pickers (curated)
export const INCLUSION_ICON_CHOICES: Array<{ value: string; label: string }> = [
  { value: 'check',         label: 'Check' },
  { value: 'key',           label: 'Exclusividad / Llave' },
  { value: 'clock',         label: 'Horario / Tiempo' },
  { value: 'shield-check',  label: 'Seguridad' },
  { value: 'wifi',          label: 'WiFi' },
  { value: 'parking',       label: 'Parking' },
  { value: 'music',         label: 'Música' },
  { value: 'disco',         label: 'DJ / Discoteca' },
  { value: 'lightbulb',     label: 'Iluminación' },
  { value: 'umbrella',      label: 'Plan B / Lluvia' },
  { value: 'sparkles',      label: 'Limpieza / Brillo' },
  { value: 'bed',           label: 'Alojamiento / Cama' },
  { value: 'utensils',      label: 'Comida / Cubertería' },
  { value: 'wine',          label: 'Vino' },
  { value: 'cocktail',      label: 'Coctel / Bar' },
  { value: 'heart',         label: 'Atención / Amor' },
  { value: 'calendar',      label: 'Fecha' },
  { value: 'accessibility', label: 'Accesibilidad' },
  { value: 'tree',          label: 'Jardín / Árbol' },
  { value: 'mountain',      label: 'Vistas / Naturaleza' },
  { value: 'users',         label: 'Invitados' },
  { value: 'camera',        label: 'Fotografía' },
  { value: 'moon',          label: 'Noche' },
  { value: 'sun',           label: 'Día' },
  { value: 'location',      label: 'Ubicación' },
  { value: 'phone',         label: 'Teléfono' },
  { value: 'mail',          label: 'Email' },
  { value: 'building',      label: 'Edificio / Venue' },
  { value: 'door',          label: 'Acceso' },
  { value: 'flame',         label: 'Chimenea' },
  { value: 'snowflake',     label: 'Climatización' },
  { value: 'star',          label: 'Destacado' },
  { value: 'flower',        label: 'Flores' },
  { value: 'sgae',          label: 'SGAE / Licencia' },
  { value: 'party',         label: 'Fiesta' },
]

export function InclusionIcon({ name, size = 22, color, strokeWidth = 1.6 }: {
  name?: string; size?: number; color?: string; strokeWidth?: number
}) {
  if (!name) return null
  const key = name.toLowerCase().replace(/[_\s]/g, '-')
  const Comp = INCLUSION_ICONS[key] || INCLUSION_ICONS[key.replace(/-/g, '')]
  if (!Comp) return null
  return <Comp size={size} color={color} strokeWidth={strokeWidth} />
}

export function StarRating({ rating = 5, size = 14, color }: {
  rating?: number; size?: number; color?: string
}) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, color }}>
      {Array.from({ length: Math.max(0, Math.min(5, rating)) }).map((_, i) => (
        <Star key={i} size={size} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
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

// ─── Floating WhatsApp button ─────────────────────────────────────────────────
export function FloatingWhatsApp({ phone, coupleName, primary, onPrimary }: {
  phone: string; coupleName: string; primary: string; onPrimary: string
}) {
  const [open, setOpen] = useState(false)

  if (!phone) return null
  const waMsg  = encodeURIComponent(`Hola 👋 he visto la propuesta para ${coupleName} y me gustaría hablar con vosotros.`)
  const waLink = `https://wa.me/${phone.replace(/\D/g, '')}?text=${waMsg}`

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 20, zIndex: 9000,
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
  const [isMobile, setIsMobile] = useState(false)
  const n = photos.length
  const VISIBLE = isMobile ? 2 : 4
  const maxIdx = Math.max(0, n - VISIBLE)
  const canSlide = n > VISIBLE

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!canSlide || paused) return
    const t = setInterval(() => setIdx(i => (i >= maxIdx ? 0 : i + 1)), 3500)
    return () => clearInterval(t)
  }, [canSlide, paused, maxIdx])

  if (!n) return null

  // 1–3 images → equal grid, colapsa a 1 columna en móvil
  if (n <= 3) {
    const cols = isMobile ? 1 : n
    const ratio = n === 1 ? '21/9' : (isMobile ? '3/2' : '4/2')
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ overflow: 'hidden', aspectRatio: ratio }}>
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
          <div key={i} style={{ flex: `0 0 ${isMobile ? '50%' : '25%'}`, height: isMobile ? 180 : 240, overflow: 'hidden', padding: '0 1.5px' }}>
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

// ─── Venue Rental Grid — tarifas temporada × día ─────────────────────────────
export function VenueRentalGrid({
  data, primary, dark = false,
}: {
  data: SectionsData['venue_rental']
  primary: string
  dark?: boolean
}) {
  if (!data) return null
  const rows = data.rows ?? []
  const tiers = data.day_tiers ?? []
  if (!rows.length || !tiers.length) return null
  const txtMuted = dark ? 'rgba(255,255,255,.5)' : '#6a6560'
  const txt = dark ? '#fff' : '#181410'
  const line = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const accent = dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.02)'

  return (
    <div>
      {data.title && (
        <div style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: primary, marginBottom: 8 }}>
          {data.title}
        </div>
      )}
      {data.intro && <p style={{ fontSize: '.88rem', color: txtMuted, lineHeight: 1.7, marginBottom: 20, maxWidth: 640 }}>{data.intro}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '12px 14px', borderBottom: `1px solid ${line}`, fontWeight: 600, color: txtMuted, fontSize: '.72rem', letterSpacing: '.12em', textTransform: 'uppercase' }}>
                Temporada
              </th>
              {tiers.map((t, i) => (
                <th key={i} style={{ textAlign: 'right', padding: '12px 14px', borderBottom: `1px solid ${line}`, fontWeight: 600, color: txtMuted, fontSize: '.72rem', letterSpacing: '.08em' }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 1 ? accent : 'transparent' }}>
                <td style={{ padding: '12px 14px', color: txt, fontWeight: 500 }}>{r.season}</td>
                {tiers.map((_, ci) => {
                  const v = r.prices?.[ci]
                  return (
                    <td key={ci} style={{ padding: '12px 14px', textAlign: 'right', color: v ? txt : txtMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {v || '—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.notes && (
        <div style={{ fontSize: '.75rem', color: txtMuted, marginTop: 12, fontStyle: 'italic' }}>{data.notes}</div>
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
    hasCatering: sec.has_catering !== false,
    on: (id: string) => sec.sections_enabled?.[id] !== false,
    packagesShow:   so.packages_override    != null ? so.packages_override    : vc.packages      ?? [],
    zonesShow:      so.zones_override       != null ? so.zones_override       : vc.zones          ?? [],
    seasonsShow:    so.season_prices_override != null ? so.season_prices_override : vc.season_prices ?? [],
    inclusionsShow: so.inclusions_override  != null ? so.inclusions_override  : vc.inclusions     ?? [],
    faqShow:        so.faq_override         != null ? so.faq_override         : vc.faq            ?? [],
    collabsShow:    so.collaborators_override != null ? so.collaborators_override : vc.collaborators ?? [],
    extrasShow:     so.extra_services_override != null ? so.extra_services_override : vc.extra_services ?? [],
    menuShow:       so.menu_prices_override != null ? so.menu_prices_override : vc.menu_prices    ?? [],
    menusStructured: (so.menus_override ?? null) as Menu[] | null,
    menuExtras:      (so.menu_extras_override ?? null) as MenuExtra[] | null,
    appetizersBase:  (so.appetizers_base_override ?? null) as AppetizerGroup[] | null,
    expShow:        so.experience_override  != null ? so.experience_override  : vc.experience,
    testsShow:      so.testimonials_override != null
                      ? so.testimonials_override
                      : (sec.testimonials && sec.testimonials.length ? sec.testimonials : (vc.testimonials ?? [])),
    techspecs:      vc.techspecs,
    accom:          (so.accommodation && Object.keys(so.accommodation).length > 0) ? so.accommodation : vc.accommodation_info,
    mapVC:          vc.map_info,
    budgetSim:      vc.budget_simulator,
    spaceGroups:    (so.space_groups ?? null) as import('@/lib/proposal-types').SpaceGroup[] | null,
  }
}
