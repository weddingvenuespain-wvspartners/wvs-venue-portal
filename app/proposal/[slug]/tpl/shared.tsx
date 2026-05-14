'use client'
// Shared utilities for all proposal templates

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
import type { Menu, MenuExtra, AppetizerGroup, SectionsData } from '@/lib/proposal-types'
import { isSectionAllowed } from '@/lib/section-visibility'

export type { ProposalData }
export type { MenuItem, MenuCourse, Menu, MenuExtra, AppetizerGroup, SectionsData } from '@/lib/proposal-types'

// ─── ZoneSlider — shared multi-photo slider for zone cards ─────────────────────
export function ZoneSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0)
  if (photos.length === 1) {
    return <img src={photos[0]} alt={name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
  }
  return (
    <>
      <img src={photos[idx]} alt={name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'opacity .4s' }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
      <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 2 }}>
        {photos.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,.4)', transition: 'background .2s' }} />
        ))}
      </div>
      <button onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
        style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
      <button onClick={() => setIdx(i => (i + 1) % photos.length)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
    </>
  )
}

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

export function formatZonePrice(raw: string | undefined): string {
  if (!raw?.trim()) return ''
  const s = raw.trim()
  if (s.includes('€')) return s
  // Pure number (possibly with sign)
  const num = parseFloat(s.replace(/[^0-9.,]/g, '').replace(',', '.'))
  if (!isNaN(num) && num > 0) {
    const prefix = s.startsWith('-') ? '-' : '+'
    return `${prefix}${num.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`
  }
  return s
}

export function formatZoneFeatures(z: any): string[] {
  const out: string[] = []
  if (z?.sqm) out.push(`${z.sqm} m²`)
  if (z?.covered && ZONE_COVERED_LABELS[z.covered]) out.push(ZONE_COVERED_LABELS[z.covered])
  // Free-text features (new model)
  if (Array.isArray(z?.features) && z.features.length) {
    z.features.forEach((f: string) => { if (f?.trim()) out.push(f.trim()) })
  } else {
    // Backward compat: legacy boolean flags
    if (z?.climatized) out.push('Climatizado')
    if (z?.plan_b) out.push('Plan B cubierto')
  }
  return out
}

export function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Replace {{pareja}}, {{invitados}}, {{fecha}} in any string */
export function replacePlaceholders(text: string | null, data: { couple_name?: string | null; guest_count?: number | null; wedding_date?: string | null }): string | null {
  if (!text) return null
  return text
    .replace(/\{\{pareja\}\}/gi, data.couple_name ?? '')
    .replace(/\{\{invitados\}\}/gi, String(data.guest_count ?? ''))
    .replace(/\{\{fecha\}\}/gi, data.wedding_date
      ? new Date(data.wedding_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : '')
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
  Palette, Cake, Baby, Dog, Shirt, Gift, Compass, Crown, Gem, Timer, Tent,
  Waves, Glasses, Drumstick, ChefHat, Mic2, Zap, Trophy, Smile,
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
  palette: Palette, decoration: Palette, decor: Palette, art: Palette,
  cake: Cake, dessert: Cake, bakery: Cake,
  baby: Baby, kids: Baby, children: Baby,
  dog: Dog, pets: Dog, animals: Dog,
  shirt: Shirt, dress: Shirt, attire: Shirt, fashion: Shirt,
  gift: Gift, present: Gift, favor: Gift, welcome: Gift,
  compass: Compass, adventure: Compass, explore: Compass,
  crown: Crown, luxury: Crown, royal: Crown, vip: Crown,
  gem: Gem, diamond: Gem, ring: Gem, jewelry: Gem,
  timer: Timer, countdown: Timer, duration: Timer,
  tent: Tent, carpa: Tent,
  waves: Waves, pool: Waves, water: Waves, beach: Waves,
  glasses: Glasses, toast: Glasses, cheers: Glasses, brindis: Glasses,
  drumstick: Drumstick, chicken: Drumstick, meat: Drumstick,
  chef: ChefHat, cook: ChefHat, catering: ChefHat,
  mic: Mic2, karaoke: Mic2, speech: Mic2, ceremony: Mic2,
  zap: Zap, energy: Zap, power: Zap, electric: Zap,
  trophy: Trophy, award: Trophy, winner: Trophy, best: Trophy,
  smile: Smile, happy: Smile, fun: Smile, joy: Smile,
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
  { value: 'palette',       label: 'Decoración / Arte' },
  { value: 'cake',          label: 'Tarta / Repostería' },
  { value: 'baby',          label: 'Niños / Bebés' },
  { value: 'dog',           label: 'Mascotas' },
  { value: 'shirt',         label: 'Vestuario' },
  { value: 'gift',          label: 'Regalos / Detalles' },
  { value: 'compass',       label: 'Aventura / Explorar' },
  { value: 'crown',         label: 'Lujo / VIP' },
  { value: 'gem',           label: 'Anillo / Joyería' },
  { value: 'timer',         label: 'Duración / Cuenta atrás' },
  { value: 'tent',          label: 'Carpa / Exterior' },
  { value: 'waves',         label: 'Piscina / Playa' },
  { value: 'glasses',       label: 'Brindis' },
  { value: 'drumstick',     label: 'Carne / Asado' },
  { value: 'chef',          label: 'Chef / Catering' },
  { value: 'mic',           label: 'Micro / Ceremonia' },
  { value: 'zap',           label: 'Energía / Eléctrico' },
  { value: 'trophy',        label: 'Premio / Mejor' },
  { value: 'smile',         label: 'Diversión / Alegría' },
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
      position: 'fixed', bottom: 80, right: 20, zIndex: 9000,
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

// ─── Mobile Slider — touch-swipeable horizontal carousel ─────────────────────
function MobileSlider({ photos }: { photos: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const n = photos.length

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const w = el.clientWidth
      if (w > 0) setIdx(Math.round(el.scrollLeft / w))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} style={{
        display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
      }}>
        <style>{`.mob-slider::-webkit-scrollbar{display:none}`}</style>
        {photos.map((url, i) => (
          <div key={i} className="mob-slider" style={{
            flex: '0 0 85%', scrollSnapAlign: 'center', height: 220,
            overflow: 'hidden', marginRight: 6, borderRadius: 6, cursor: 'pointer',
          }} onClick={() => setLightboxIdx(i)}>
            <img src={url} alt="" loading={i < 3 ? 'eager' : 'lazy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        ))}
      </div>
      {n > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 10 }}>
          {photos.map((_, i) => (
            <div key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i === idx ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.15)',
              transition: 'background .2s',
            }} />
          ))}
        </div>
      )}
      {lightboxIdx !== null && <GalleryLightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />}
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
    if (isMobile && n > 1) return <MobileSlider photos={photos} />
    const ratio = n === 1 ? '21/9' : '4/2'
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 3 }}>
        {photos.map((url, i) => (
          <div key={i} style={{ overflow: 'hidden', aspectRatio: isMobile ? '16/10' : ratio }}>
            <img src={url} alt="" loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
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

// ─── Gallery Lightbox (fullscreen overlay) ──────────────────────────────────
function GalleryLightbox({ photos, startIdx, onClose }: { photos: string[]; startIdx: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIdx)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % photos.length)
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + photos.length) % photos.length)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = '' }
  }, [photos.length, onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <img src={photos[idx]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 4 }} onClick={e => e.stopPropagation()} />
      {photos.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + photos.length) % photos.length) }}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: '1.5rem', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % photos.length) }}
            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: '1.5rem', width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </>
      )}
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', fontSize: '1.2rem', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      {photos.length > 1 && <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.6)', fontSize: '.8rem' }}>{idx + 1} / {photos.length}</div>}
    </div>
  )
}

// ─── Gallery Mosaic — primera foto grande + grid asimétrico el resto ─────────
export function GalleryMosaic({ photos }: { photos: string[]; primary?: string; dark?: boolean }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!photos.length) return null

  // Mobile: touch-swipeable slider
  if (isMobile) return <MobileSlider photos={photos} />

  // Desktop: primera foto grande a la izquierda, resto en grid 2x2 a la derecha
  const [first, ...rest] = photos
  const sideCount = Math.min(rest.length, 4)
  const side = rest.slice(0, sideCount)
  const remainder = rest.slice(sideCount)

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const allPhotos = [first, ...rest]

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 4, aspectRatio: '21/7' }}>
          <div style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxIdx(0)}>
            <img src={first} alt="" loading="eager"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          {side.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: side.length > 1 ? 'repeat(2, 1fr)' : '1fr', gridAutoRows: '1fr', gap: 4 }}>
              {side.map((url, i) => (
                <div key={i} style={{ overflow: 'hidden', cursor: 'pointer' }} onClick={() => setLightboxIdx(i + 1)}>
                  <img src={url} alt="" loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
        </div>
        {remainder.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(remainder.length, 4)}, 1fr)`, gap: 4 }}>
            {remainder.slice(0, 4).map((url, i) => (
              <div key={i} style={{ overflow: 'hidden', aspectRatio: '4/3', cursor: 'pointer' }} onClick={() => setLightboxIdx(sideCount + 1 + i)}>
                <img src={url} alt="" loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        )}
      </div>
      {lightboxIdx !== null && <GalleryLightbox photos={allPhotos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />}
    </>
  )
}

// ─── Gallery Grid — todas iguales en cuadrícula uniforme ─────────────────────
export function GalleryGrid({ photos }: { photos: string[]; primary?: string; dark?: boolean }) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!photos.length) return null

  // Mobile: touch-swipeable slider
  if (isMobile) return <MobileSlider photos={photos} />

  const cols = photos.length <= 4 ? photos.length : photos.length <= 9 ? 3 : 4

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4 }}>
      {photos.map((url, i) => (
        <div key={i} style={{ overflow: 'hidden', aspectRatio: '4/3' }}>
          <img src={url} alt="" loading={i < 6 ? 'eager' : 'lazy'}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ))}
    </div>
  )
}

// ─── Inclusions ──────────────────────────────────────────────────────────────
// Three layout variants: grid (default cards), list (compact vertical), cards (prominent).

type InclusionItem = { title?: string; description?: string; icon?: string; emoji?: string }

function InclusionGlyph({ inc, primary, size = 22 }: { inc: InclusionItem; primary: string; size?: number }) {
  if (inc.icon) return <InclusionIcon name={inc.icon} size={size} color={primary} />
  if (inc.emoji && !/\p{Extended_Pictographic}/u.test(inc.emoji))
    return <InclusionIcon name={inc.emoji} size={size} color={primary} />
  return <InclusionIcon name="check" size={size} color={primary} />
}

export function InclusionsGrid({ items, primary, dark = true, columns = 2 }: { items: InclusionItem[]; primary: string; dark?: boolean; columns?: number }) {
  if (!items.length) return null
  const rgb = toRgb(primary)
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const bg = dark ? 'rgba(255,255,255,.02)' : '#fff'
  const titleColor = dark ? 'rgba(255,255,255,.88)' : '#181410'
  const descColor = dark ? 'rgba(255,255,255,.45)' : '#6a6560'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 14 }}>
      {items.map((inc, i) => (
        <div key={i}
          style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '22px 20px', border: `1px solid ${border}`, borderRadius: 14, background: bg, transition: 'border-color .2s, background .2s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${rgb}, .35)`; e.currentTarget.style.background = `rgba(${rgb}, .05)` }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.background = bg }}
        >
          <span style={{ flexShrink: 0, marginTop: 2, width: 36, height: 36, borderRadius: 10, background: `rgba(${rgb}, .14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: primary }}>
            <InclusionGlyph inc={inc} primary={primary} size={22} />
          </span>
          <div>
            <div style={{ fontSize: '.92rem', fontWeight: 500, color: titleColor, marginBottom: 3 }}>{inc.title}</div>
            {inc.description && <div style={{ fontSize: '.78rem', color: descColor, lineHeight: 1.55 }}>{inc.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function InclusionsList({ items, primary, dark = true, columns = 2 }: { items: InclusionItem[]; primary: string; dark?: boolean; columns?: number }) {
  if (!items.length) return null
  const divider = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const titleColor = dark ? 'rgba(255,255,255,.92)' : '#181410'
  const descColor = dark ? 'rgba(255,255,255,.5)' : '#6a6560'
  const perCol = Math.ceil(items.length / columns)
  const cols = Array.from({ length: columns }, (_, ci) => items.slice(ci * perCol, (ci + 1) * perCol))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '0 32px' }}>
      {cols.map((col, ci) => (
        <div key={ci} style={{ display: 'flex', flexDirection: 'column' }}>
          {col.map((inc, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 4px', borderBottom: i < col.length - 1 ? `1px solid ${divider}` : 'none' }}>
              <span style={{ flexShrink: 0, color: primary, display: 'inline-flex' }}>
                <InclusionGlyph inc={inc} primary={primary} size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: '.95rem', fontWeight: 500, color: titleColor }}>{inc.title}</div>
                {inc.description && <div style={{ fontSize: '.78rem', color: descColor, lineHeight: 1.5 }}>{inc.description}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function InclusionsCards({ items, primary, dark = true, columns = 2 }: { items: InclusionItem[]; primary: string; dark?: boolean; columns?: number }) {
  if (!items.length) return null
  const rgb = toRgb(primary)
  const border = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'
  const bg = dark ? 'rgba(255,255,255,.03)' : '#fff'
  const titleColor = dark ? '#fff' : '#181410'
  const descColor = dark ? 'rgba(255,255,255,.55)' : '#6a6560'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 18 }}>
      {items.map((inc, i) => (
        <div key={i}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 14, padding: '32px 20px 26px', border: `1px solid ${border}`, borderRadius: 16, background: bg, transition: 'border-color .25s, background .25s, transform .25s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${rgb}, .45)`; e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = '' }}
        >
          <span style={{ width: 56, height: 56, borderRadius: '50%', background: `rgba(${rgb}, .14)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: primary }}>
            <InclusionGlyph inc={inc} primary={primary} size={28} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '.98rem', fontWeight: 600, color: titleColor, letterSpacing: '.01em' }}>{inc.title}</div>
            {inc.description && <div style={{ fontSize: '.8rem', color: descColor, lineHeight: 1.55 }}>{inc.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Testimonials ────────────────────────────────────────────────────────────
// Three layout variants: cards (default), quotes (large typography), compact (avatar list).

type TestimonialItem = {
  couple_name?: string
  names?: string
  text?: string
  rating?: number
  wedding_date?: string
  date?: string
  photo_url?: string
}

function fmtTestimonialDate(t: TestimonialItem): string {
  const raw = t.wedding_date || t.date
  if (!raw) return ''
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? (formatDate(raw) ?? raw) : raw
}

function getInitials(name: string): string {
  return name
    .split(/[\s&,]+/)
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('')
}

export function TestimonialsCards({ items, primary, dark = true, font }: { items: TestimonialItem[]; primary: string; dark?: boolean; font?: string }) {
  if (!items.length) return null
  const rgb = toRgb(primary)
  const cardBg = dark ? '#111' : '#fff'
  const border = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'
  const textColor = dark ? 'rgba(255,255,255,.75)' : '#3a342f'
  const nameColor = dark ? '#fff' : '#181410'
  const dividerColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const FONT = font || "'Cormorant Garamond', Georgia, serif"
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24, alignItems: 'stretch' }}>
      {items.map((t, i) => {
        const name = t.couple_name || t.names || ''
        const dateStr = fmtTestimonialDate(t)
        return (
          <div key={i}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18, padding: '32px 32px 28px', background: cardBg, border: `1px solid ${border}`, borderRadius: 4, overflow: 'hidden', transition: 'border-color .3s, transform .3s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${rgb}, .35)`; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.transform = '' }}
          >
            <span aria-hidden style={{ position: 'absolute', top: 8, right: 20, fontFamily: FONT, fontSize: '7rem', lineHeight: .7, color: primary, opacity: .1, userSelect: 'none', pointerEvents: 'none' }}>"</span>
            <div style={{ position: 'relative', zIndex: 1 }}><StarRating rating={t.rating ?? 5} size={14} color="#F5A623" /></div>
            <p style={{ fontFamily: FONT, fontStyle: 'italic', fontSize: '1.02rem', lineHeight: 1.75, color: textColor, flex: 1, position: 'relative', zIndex: 1, paddingLeft: 16, borderLeft: `2px solid ${primary}`, margin: 0 }}>
              "{t.text}"
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 18, borderTop: `1px solid ${dividerColor}`, marginTop: 'auto', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '.92rem', fontWeight: 600, color: nameColor, letterSpacing: '.01em' }}>{name}</div>
              {dateStr && <div style={{ fontSize: '.72rem', color: primary, fontWeight: 500, letterSpacing: '.08em', textTransform: 'uppercase' }}>{dateStr}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TestimonialsQuotes({ items, primary, dark = true, font }: { items: TestimonialItem[]; primary: string; dark?: boolean; font?: string }) {
  if (!items.length) return null
  const textColor = dark ? 'rgba(255,255,255,.85)' : '#3a342f'
  const nameColor = dark ? '#fff' : '#181410'
  const divider = dark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)'
  const FONT = font || "'Cormorant Garamond', Georgia, serif"
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((t, i) => {
        const name = t.couple_name || t.names || ''
        const dateStr = fmtTestimonialDate(t)
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ padding: '36px 24px', borderBottom: isLast ? 'none' : `1px solid ${divider}`, textAlign: 'center', maxWidth: 720, margin: '0 auto', width: '100%' }}>
            <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'center' }}>
              <StarRating rating={t.rating ?? 5} size={15} color="#F5A623" />
            </div>
            <p style={{ fontFamily: FONT, fontSize: 'clamp(1.3rem, 2vw, 1.7rem)', lineHeight: 1.5, fontStyle: 'italic', fontWeight: 300, color: textColor, margin: '0 0 22px', letterSpacing: '-.005em' }}>
              "{t.text}"
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <div style={{ width: 28, height: 1, background: primary, marginBottom: 6 }} />
              <div style={{ fontSize: '.92rem', fontWeight: 600, color: nameColor, letterSpacing: '.04em' }}>{name}</div>
              {dateStr && <div style={{ fontSize: '.7rem', color: primary, fontWeight: 500, letterSpacing: '.12em', textTransform: 'uppercase' }}>{dateStr}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TestimonialsCompact({ items, primary, dark = true }: { items: TestimonialItem[]; primary: string; dark?: boolean; font?: string }) {
  if (!items.length) return null
  const rgb = toRgb(primary)
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const bg = dark ? 'rgba(255,255,255,.02)' : '#fff'
  const textColor = dark ? 'rgba(255,255,255,.78)' : '#3a342f'
  const nameColor = dark ? '#fff' : '#181410'
  const subColor = dark ? 'rgba(255,255,255,.5)' : '#6a6560'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((t, i) => {
        const name = t.couple_name || t.names || ''
        const dateStr = fmtTestimonialDate(t)
        const initials = getInitials(name) || '·'
        return (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '18px 20px', background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
            <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: '50%', background: `rgba(${rgb}, .2)`, color: primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '.85rem', letterSpacing: '.02em' }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '.92rem', fontWeight: 600, color: nameColor }}>{name}</span>
                <StarRating rating={t.rating ?? 5} size={11} color="#F5A623" />
                {dateStr && <span style={{ fontSize: '.7rem', color: subColor, marginLeft: 'auto' }}>{dateStr}</span>}
              </div>
              <p style={{ fontSize: '.85rem', lineHeight: 1.6, color: textColor, margin: 0 }}>"{t.text}"</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TestimonialsFeatured({ items, primary, dark = true, font }: { items: TestimonialItem[]; primary: string; dark?: boolean; font?: string }) {
  const [idx, setIdx] = useState(0)
  if (!items.length) return null
  const rgb = toRgb(primary)
  const FONT = font || "'Cormorant Garamond', Georgia, serif"
  const textColor = dark ? 'rgba(255,255,255,.85)' : '#3a342f'
  const nameColor = dark ? '#fff' : '#181410'
  const t = items[idx % items.length]
  const name = t.couple_name || t.names || ''
  const dateStr = fmtTestimonialDate(t)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: t.photo_url ? '1fr 1fr' : '1fr', gap: 0, overflow: 'hidden', borderRadius: 8, background: dark ? 'rgba(255,255,255,.03)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'}` }}>
      {t.photo_url && (
        <div style={{ minHeight: 340 }}>
          <img src={t.photo_url} alt={name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
        </div>
      )}
      <div style={{ padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>
        <span aria-hidden style={{ fontFamily: FONT, fontSize: '5rem', lineHeight: .7, color: primary, opacity: .2 }}>"</span>
        <p style={{ fontFamily: FONT, fontSize: 'clamp(1.1rem, 1.8vw, 1.4rem)', lineHeight: 1.7, fontStyle: 'italic', fontWeight: 300, color: textColor, margin: 0 }}>
          {t.text}
        </p>
        <div>
          <div style={{ width: 28, height: 2, background: primary, marginBottom: 14, borderRadius: 1 }} />
          <div style={{ fontSize: '.95rem', fontWeight: 600, color: nameColor }}>{name}</div>
          {dateStr && <div style={{ fontSize: '.72rem', color: primary, fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 4 }}>{dateStr}</div>}
          <div style={{ marginTop: 10 }}><StarRating rating={t.rating ?? 5} size={14} color="#F5A623" /></div>
        </div>
        {items.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {items.map((_, i) => (
              <button key={i} onClick={() => setIdx(i)}
                style={{ width: 10, height: 10, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? primary : `rgba(${rgb},.25)`, transition: 'background .2s' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
// Three layout variants: accordion (default), cards (expandable with shadow), numbered (always-visible).

type FaqItem = { question?: string; answer?: string }

export function FaqAccordion({ items, primary, dark = true }: { items: FaqItem[]; primary: string; dark?: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (!items.length) return null
  const divider = dark ? '#181818' : 'rgba(0,0,0,.08)'
  const qColor = dark ? 'rgba(255,255,255,.75)' : '#181410'
  const aColor = dark ? 'rgba(255,255,255,.42)' : '#5a544f'
  return (
    <div>
      {items.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={i} style={{ borderBottom: `1px solid ${divider}` }}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 20 }}
            >
              <span style={{ fontSize: '.95rem', fontWeight: 500, color: isOpen ? primary : qColor, transition: 'color .2s' }}>
                {item.question}
              </span>
              <span style={{ fontSize: '1.4rem', fontWeight: 200, color: primary, flexShrink: 0, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
            </button>
            <div style={{ overflow: 'hidden', maxHeight: isOpen ? 400 : 0, transition: 'max-height .4s cubic-bezier(.22,1,.36,1)' }}>
              <div style={{ fontSize: '.87rem', color: aColor, lineHeight: 1.85, paddingBottom: 20 }}>
                {item.answer}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FaqCards({ items, primary, dark = true }: { items: FaqItem[]; primary: string; dark?: boolean }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (!items.length) return null
  const rgb = toRgb(primary)
  const cardBg = dark ? 'rgba(255,255,255,.02)' : '#fff'
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const qColor = dark ? 'rgba(255,255,255,.92)' : '#181410'
  const aColor = dark ? 'rgba(255,255,255,.55)' : '#5a544f'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${isOpen ? `rgba(${rgb}, .35)` : border}`,
              borderRadius: 12,
              background: cardBg,
              overflow: 'hidden',
              transition: 'border-color .25s, box-shadow .25s',
              boxShadow: isOpen ? `0 8px 24px rgba(0,0,0,${dark ? .35 : .08})` : 'none',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : i)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 20 }}
            >
              <span style={{ fontSize: '.95rem', fontWeight: 600, color: isOpen ? primary : qColor, transition: 'color .2s' }}>
                {item.question}
              </span>
              <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: isOpen ? primary : `rgba(${rgb}, .14)`, color: isOpen ? '#fff' : primary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 300, transform: isOpen ? 'rotate(45deg)' : 'none', transition: 'transform .25s, background .2s, color .2s' }}>+</span>
            </button>
            <div style={{ overflow: 'hidden', maxHeight: isOpen ? 600 : 0, transition: 'max-height .4s cubic-bezier(.22,1,.36,1)' }}>
              <div style={{ fontSize: '.87rem', color: aColor, lineHeight: 1.8, padding: '0 22px 22px' }}>
                {item.answer}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function FaqNumbered({ items, primary, dark = true }: { items: FaqItem[]; primary: string; dark?: boolean }) {
  if (!items.length) return null
  const qColor = dark ? '#fff' : '#181410'
  const aColor = dark ? 'rgba(255,255,255,.55)' : '#5a544f'
  const divider = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <div key={i} style={{ display: 'flex', gap: 24, padding: '28px 0', borderBottom: isLast ? 'none' : `1px solid ${divider}` }}>
            <div style={{ flexShrink: 0, fontSize: '.78rem', fontWeight: 600, color: primary, letterSpacing: '.12em', minWidth: 28 }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: qColor, lineHeight: 1.45 }}>
                {item.question}
              </div>
              <div style={{ fontSize: '.87rem', color: aColor, lineHeight: 1.8 }}>
                {item.answer}
              </div>
            </div>
          </div>
        )
      })}
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

// ─── Pricing — packages renderers ─────────────────────────────────────────────
// Three variants share the same package data:
//   • PricingCards: cards apiladas (default), one per package
//   • PricingTable: compact tabular comparison
//   • VenueRentalGrid (above): alternate horario × temporada grid

export type PackageItem = {
  name?: string
  subtitle?: string
  price?: string
  description?: string
  includes?: string[]
  is_recommended?: boolean
  min_guests?: number
  max_guests?: number
}

export function PricingCards({ packages, primary, dark = true, font }: { packages: PackageItem[]; primary: string; dark?: boolean; font?: string }) {
  if (!packages.length) return null
  const rgb = toRgb(primary)
  const FONT = font || "'Cormorant Garamond', Georgia, serif"
  const surface = dark ? 'rgba(255,255,255,.04)' : '#fff'
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const text = dark ? 'rgba(255,255,255,.88)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.45)' : '#6a6560'
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
      {packages.map((p, i) => (
        <div key={i} style={{
          background: surface, padding: '36px 28px',
          display: 'flex', flexDirection: 'column',
          borderRadius: 8, border: `1px solid ${border}`,
          ...(p.is_recommended ? { borderTop: `2px solid ${primary}` } : {}),
        }}>
          {p.is_recommended && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '.58rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, background: `rgba(${rgb},.12)`, padding: '4px 10px', borderRadius: 100, marginBottom: 14, alignSelf: 'flex-start' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: primary }} />
              Más elegido
            </div>
          )}
          <div style={{ fontFamily: FONT, fontSize: '1.7rem', fontWeight: 300, color: text, marginBottom: 4 }}>{p.name}</div>
          {p.subtitle && <div style={{ fontSize: '.78rem', color: sub, marginBottom: 20 }}>{p.subtitle}</div>}
          {p.price && (
            <div style={{ fontFamily: FONT, fontSize: 'clamp(2.2rem,4vw,3.2rem)', fontWeight: 300, color: primary, lineHeight: 1, margin: '8px 0 24px' }}>
              {p.price} <span style={{ fontSize: '1rem', color: sub, fontFamily: 'Inter, sans-serif' }}>/ persona</span>
            </div>
          )}
          {(p.includes?.length ?? 0) > 0 && (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9, flex: 1, padding: 0, margin: 0 }}>
              {p.includes!.filter(Boolean).map((inc, j) => (
                <li key={j} style={{ fontSize: '.82rem', color: sub, display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: primary, flexShrink: 0, marginTop: 7 }} />
                  {inc}
                </li>
              ))}
            </ul>
          )}
          {(p.min_guests || p.max_guests) && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${border}`, fontSize: '.75rem', color: sub }}>
              {p.min_guests && `Mín. ${p.min_guests}`}{p.min_guests && p.max_guests ? ' · ' : ''}{p.max_guests && `Máx. ${p.max_guests}`} invitados
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function PricingTable({ packages, primary, dark = true, font }: { packages: PackageItem[]; primary: string; dark?: boolean; font?: string }) {
  if (!packages.length) return null
  const rgb = toRgb(primary)
  const FONT = font || "'Cormorant Garamond', Georgia, serif"
  const border = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'
  const text = dark ? 'rgba(255,255,255,.88)' : '#181410'
  const sub = dark ? 'rgba(255,255,255,.45)' : '#6a6560'
  const headerBg = dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)'
  const cellPad = '18px 20px'
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${border}`, borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.88rem' }}>
        <thead>
          <tr style={{ background: headerBg }}>
            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: sub, borderBottom: `1px solid ${border}` }}>Paquete</th>
            <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: sub, borderBottom: `1px solid ${border}` }}>Invitados</th>
            <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: sub, borderBottom: `1px solid ${border}` }}>Precio</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((p, i) => {
            const guestsRange = (p.min_guests || p.max_guests)
              ? `${p.min_guests ?? ''}${p.min_guests && p.max_guests ? '–' : ''}${p.max_guests ?? ''} inv.`
              : '—'
            return (
              <tr key={i} style={{ borderBottom: i < packages.length - 1 ? `1px solid ${border}` : 'none' }}>
                <td style={{ padding: cellPad, verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: p.subtitle ? 4 : 0 }}>
                    <span style={{ fontFamily: FONT, fontSize: '1.2rem', fontWeight: 400, color: text }}>{p.name}</span>
                    {p.is_recommended && (
                      <span style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: primary, padding: '2px 8px', borderRadius: 99, background: `rgba(${rgb},.12)` }}>Recomendado</span>
                    )}
                  </div>
                  {p.subtitle && <div style={{ fontSize: '.78rem', color: sub }}>{p.subtitle}</div>}
                </td>
                <td style={{ padding: cellPad, verticalAlign: 'top', fontSize: '.85rem', color: sub, fontVariantNumeric: 'tabular-nums' }}>
                  {guestsRange}
                </td>
                <td style={{ padding: cellPad, verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: FONT, fontSize: '1.4rem', fontWeight: 300, color: primary }}>{p.price || '—'}</span>
                  {p.price && <span style={{ fontSize: '.7rem', color: sub, marginLeft: 4 }}>/ pers.</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
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
  const spaceType = (data.commercialConfig as any)?.space_type ?? null
  return {
    sec,
    hasCatering: sec.has_catering !== false,
    spaceType,
    on: (id: string) => {
      if (sec.sections_enabled?.[id] === false) return false
      if (spaceType && !isSectionAllowed(id, spaceType)) return false
      return true
    },
    packagesShow:   so.packages_override    != null ? so.packages_override    : vc.packages      ?? [],
    zonesShow:      so.zones_override       != null ? so.zones_override       : vc.zones          ?? [],
    zonesMode:      (so.zones_header?.mode ?? 'zones') as 'single' | 'zones',
    seasonsShow:    so.season_prices_override != null ? so.season_prices_override : vc.season_prices ?? [],
    inclusionsShow: so.inclusions_override  != null ? so.inclusions_override  : vc.inclusions     ?? [],
    faqShow:        so.faq_override         != null ? so.faq_override         : vc.faq            ?? [],
    collabsShow:    so.collaborators_override != null ? so.collaborators_override : vc.collaborators ?? [],
    extrasShow:     so.extra_services_override != null ? so.extra_services_override : vc.extra_services ?? [],
    menuShow:       so.menu_prices_override != null ? so.menu_prices_override : vc.menu_prices    ?? [],
    menusStructured: (so.menu_sections_visible?.menus === false ? null : (so.menus_override ?? null)) as Menu[] | null,
    menuExtras:      (() => {
      const raw = (so.menu_extras_override ?? null) as MenuExtra[] | null
      if (!raw) return null
      const msv = so.menu_sections_visible ?? {}
      return raw.filter(e => {
        if (['station'].includes(e.category) && msv.cocktail === false) return false
        if (['resopon', 'open_bar'].includes(e.category) && msv.night === false) return false
        if (['ceremony', 'music', 'audiovisual', 'other'].includes(e.category) && msv.event_extras === false) return false
        return true
      })
    })(),
    appetizersBase:  (so.menu_sections_visible?.cocktail === false ? null : (so.appetizers_base_override ?? null)) as AppetizerGroup[] | null,
    expShow:        so.experience_override  != null ? so.experience_override  : vc.experience,
    testsShow:      so.testimonials_override != null
                      ? so.testimonials_override
                      : (sec.testimonials && sec.testimonials.length ? sec.testimonials : (vc.testimonials ?? [])),
    techspecs:      vc.techspecs,
    accom:          ((so as any).accommodation_override && Object.keys((so as any).accommodation_override).length > 0) ? (so as any).accommodation_override : (so.accommodation && Object.keys(so.accommodation).length > 0) ? so.accommodation : vc.accommodation_info,
    mapVC:          vc.map_info,
    budgetSim:      vc.budget_simulator,
    spaceGroups:    (so.space_groups ?? null) as import('@/lib/proposal-types').SpaceGroup[] | null,
    dateSlots:      (so.date_slots ?? null) as import('@/lib/proposal-types').DateSlot[] | null,
  }
}

// ─── Welcome variant resolution ────────────────────────────────────────────────
// Misma lógica que T1 — lee `sections.styles.welcome` (registry) y cae a flags
// legacy (`sections_enabled.welcome_light/_split/_editorial`).
import { getActiveStyle, isSectionGroupEnabled } from '@/lib/section-styles'

export type WelcomeVariant = 'welcome' | 'welcome_light' | 'welcome_split' | 'welcome_editorial' | null

export function pickWelcomeVariant(sec: any): WelcomeVariant {
  const map: Record<string, Exclude<WelcomeVariant, null>> = {
    default:   'welcome',
    light:     'welcome_light',
    split:     'welcome_split',
    editorial: 'welcome_editorial',
  }
  if (!isSectionGroupEnabled(sec, 'welcome')) return null
  return map[getActiveStyle(sec, 'welcome')] ?? 'welcome'
}

// ─── Welcome variant blocks (light / split / editorial) ────────────────────────
// La variante "default" la mantiene cada template con su look propio.

export function TplWelcomeLight({
  message, venueName, imageUrl, primary, bg, fg, font,
}: {
  message: string
  venueName?: string | null
  imageUrl?: string
  primary: string
  bg: string
  fg: string
  font?: string
}) {
  return (
    <section id="sec-welcome" style={{ position: 'relative', padding: '72px 32px', background: bg, overflow: 'hidden' }}>
      {imageUrl && (
        <img src={imageUrl} alt="" loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.18 }} />
      )}
      <FadeUp>
        <div style={{ position: 'relative', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 1, height: 56, background: primary, margin: '0 auto 28px' }} />
          <p style={{ fontFamily: font, fontSize: 'clamp(1.2rem,2.4vw,1.6rem)', fontWeight: 300, lineHeight: 1.7, color: fg, fontStyle: 'italic' }}>
            {message}
          </p>
          {venueName && (
            <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: `${fg}99`, marginTop: 24 }}>— {venueName}</div>
          )}
        </div>
      </FadeUp>
    </section>
  )
}

export function TplWelcomeSplit({
  message, venueName, imageUrl, imageSide, primary, bg, fg, font, eyebrow,
}: {
  message: string
  venueName?: string | null
  imageUrl?: string
  imageSide?: 'left' | 'right'
  primary: string
  bg: string
  fg: string
  font?: string
  eyebrow?: string
}) {
  const right = imageSide === 'right'
  return (
    <section id="sec-welcome" style={{ background: bg }}>
      <div style={{
        display: 'grid', gridTemplateColumns: imageUrl ? '1fr 1fr' : '1fr',
        minHeight: 360,
      }}>
        {imageUrl && !right && (
          <div style={{ background: '#000' }}>
            <img src={imageUrl} alt="" loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <FadeUp>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 48px' }}>
            <span style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: primary, fontWeight: 600, marginBottom: 20 }}>
              {eyebrow ?? 'Un mensaje para vosotros'}
            </span>
            <p style={{ fontFamily: font, fontSize: 'clamp(1.15rem,2.2vw,1.5rem)', fontWeight: 300, lineHeight: 1.75, color: fg }}>
              {message}
            </p>
            {venueName && (
              <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: `${fg}99`, marginTop: 24 }}>— {venueName}</div>
            )}
          </div>
        </FadeUp>
        {imageUrl && right && (
          <div style={{ background: '#000' }}>
            <img src={imageUrl} alt="" loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
      </div>
    </section>
  )
}

export function TplWelcomeEditorial({
  message, venueName, eyebrow, primary, bg, fg, font,
}: {
  message: string
  venueName?: string | null
  eyebrow?: string
  primary: string
  bg: string
  fg: string
  font?: string
}) {
  return (
    <section id="sec-welcome" style={{ padding: '140px 32px', background: bg }}>
      <FadeUp>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          {eyebrow && (
            <span style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: primary, fontWeight: 600, marginBottom: 28, display: 'block' }}>
              {eyebrow}
            </span>
          )}
          <p style={{ fontFamily: font, fontSize: 'clamp(2rem,4.5vw,3.4rem)', fontWeight: 300, lineHeight: 1.25, color: fg, letterSpacing: '-.01em' }}>
            {message}
          </p>
          {venueName && (
            <div style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: `${fg}80`, marginTop: 36 }}>— {venueName}</div>
          )}
        </div>
      </FadeUp>
    </section>
  )
}

// ─── Reusable section blocks for T2–T5 ─────────────────────────────────────────
// Cada bloque acepta tokens de tema (primary, fg, bg, font) para encajar en la
// paleta de cada template. Importado por T2/T3/T4/T5 — T1 mantiene sus propias
// implementaciones bespoke.

export function TplStickyNav({
  venueName, logoUrl, primary, bg, fg, fontSerif, links, ctaLabel, onCta,
}: {
  venueName?: string | null
  logoUrl?: string | null
  primary: string
  bg: string                                  // background color del nav
  fg: string                                  // text color del nav
  fontSerif?: string
  links: Array<{ label: string; anchor: string }>
  ctaLabel?: string
  onCta?: () => void
}) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  if (!links.length && !ctaLabel) return null
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 32px',
      background: scrolled ? bg : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? `1px solid ${fg}1A` : '1px solid transparent',
      transition: 'background .25s, border-color .25s',
      fontFamily: fontSerif,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoUrl
          ? <img src={logoUrl} alt={venueName ?? ''} style={{ height: 26, objectFit: 'contain' }} />
          : <span style={{ fontSize: 14, fontWeight: 500, color: fg, letterSpacing: '.04em' }}>{venueName}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {links.map(l => (
          <button key={l.anchor} type="button"
            onClick={() => document.getElementById(l.anchor)?.scrollIntoView({ behavior: 'smooth' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '6px 12px', fontSize: 12, fontWeight: 500,
              color: `${fg}B3`, letterSpacing: '.04em',
              transition: 'color .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = primary)}
            onMouseLeave={e => (e.currentTarget.style.color = `${fg}B3`)}
          >{l.label}</button>
        ))}
        {ctaLabel && onCta && (
          <button type="button" onClick={onCta}
            style={{
              marginLeft: 12, padding: '8px 18px',
              background: primary, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
              cursor: 'pointer', borderRadius: 2,
            }}>{ctaLabel}</button>
        )}
      </div>
    </nav>
  )
}

export function TplVenueSpecs({
  specs, fallbackArea, primary, fg, font, label,
}: {
  specs: { founded_year?: string; area?: string; max_capacity?: string; extra_value?: string; extra_label?: string } | undefined
  fallbackArea?: string | null
  primary: string
  fg: string
  font?: string
  label?: string
}) {
  const vs = specs ?? {}
  const items = [
    { n: vs.founded_year,                      l: 'Año de fundación' },
    { n: vs.area ?? fallbackArea ?? undefined, l: 'Extensión' },
    { n: vs.max_capacity,                      l: 'Capacidad máxima' },
    { n: vs.extra_value,                       l: vs.extra_label ?? 'Detalle' },
  ].filter(s => s.n != null && s.n !== '')
  if (!items.length) return null
  return (
    <section style={{ padding: '60px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {label && (
          <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: `${fg}99`, marginBottom: 28, textAlign: 'center' }}>{label}</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 24 }}>
          {items.map((s, i) => (
            <FadeIn key={i} delay={i * 0.08}>
              <div style={{ textAlign: 'center', borderLeft: i > 0 ? `1px solid ${fg}1A` : 'none', padding: '0 12px' }}>
                <div style={{ fontFamily: font, fontSize: 'clamp(2rem,4vw,3.2rem)', fontWeight: 300, color: primary, lineHeight: 1, marginBottom: 8 }}>{s.n}</div>
                <div style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: `${fg}99` }}>{s.l}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TplSingleSpace({
  data, fallbackImage, primary, bg, fg, font, label,
}: {
  data: { subtitle?: string; title?: string; description?: string; sqm?: string; min_guests?: string; max_guests?: string; features?: string[]; image_url?: string; photos?: string[] } | undefined | null
  fallbackImage?: string | null
  primary: string
  bg: string
  fg: string
  font?: string
  label?: string
}) {
  const [photoIdx, setPhotoIdx] = useState(0)
  if (!data) return null
  const features = (Array.isArray(data.features) ? data.features : []).filter(Boolean)
  const allPhotos: string[] = [
    ...(Array.isArray(data.photos) ? data.photos : []),
    ...(data.image_url && !(data.photos ?? []).includes(data.image_url) ? [data.image_url] : []),
  ]
  const img = allPhotos[0] || fallbackImage || null
  if (!data.title && !data.description && !img && features.length === 0) return null
  const displayLabel = data.subtitle || label || null
  return (
    <section id="sec-single-space" style={{ padding: '80px 32px', background: bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: img ? '1fr 1fr' : '1fr', gap: 48, alignItems: 'center' }}>
        {img && (
          <FadeIn>
            <div style={{ position: 'relative', width: '100%', height: 440, borderRadius: 4, overflow: 'hidden' }}>
              <img src={allPhotos[photoIdx] ?? img} alt={data.title || 'Espacio'} loading="lazy"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity .4s' }} />
              {allPhotos.length > 1 && (
                <>
                  <button onClick={() => setPhotoIdx(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                  <button onClick={() => setPhotoIdx(i => (i + 1) % allPhotos.length)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,.4)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                  <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 2 }}>
                    {allPhotos.map((_, i) => (
                      <button key={i} onClick={() => setPhotoIdx(i)} style={{ width: 7, height: 7, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === photoIdx ? '#fff' : 'rgba(255,255,255,.4)', transition: 'background .2s' }} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </FadeIn>
        )}
        <FadeUp>
          {displayLabel && (
            <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: `${fg}99`, marginBottom: 16 }}>{displayLabel}</div>
          )}
          {data.title && (
            <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 300, color: fg, lineHeight: 1.1, marginBottom: 18 }}>
              {data.title}
            </h2>
          )}
          {data.description && (
            <p style={{ fontSize: 15, lineHeight: 1.8, color: `${fg}CC`, marginBottom: 24 }}>
              {data.description}
            </p>
          )}
          {(data.sqm || data.min_guests || data.max_guests) && (
            <div style={{ display: 'flex', gap: 36, padding: '20px 0', borderTop: `1px solid ${fg}14`, borderBottom: `1px solid ${fg}14`, marginBottom: 22 }}>
              {data.sqm && (
                <div>
                  <div style={{ fontFamily: font, fontSize: '1.6rem', fontWeight: 300, color: fg, lineHeight: 1 }}>{data.sqm}<span style={{ fontSize: '.7em', color: `${fg}80` }}> m²</span></div>
                  <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: `${fg}80`, marginTop: 4 }}>Superficie</div>
                </div>
              )}
              {(data.min_guests || data.max_guests) && (
                <div>
                  <div style={{ fontFamily: font, fontSize: '1.6rem', fontWeight: 300, color: fg, lineHeight: 1 }}>
                    {data.min_guests && data.max_guests ? `${data.min_guests}–${data.max_guests}` : (data.max_guests || data.min_guests)}
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: `${fg}80`, marginTop: 4 }}>
                    {data.min_guests && data.max_guests ? 'Capacidad' : data.max_guests ? 'Capacidad máx.' : 'Capacidad mín.'}
                  </div>
                </div>
              )}
            </div>
          )}
          {features.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {features.map((f, i) => (
                <span key={i} style={{ fontSize: 12, padding: '5px 12px', border: `1px solid ${fg}24`, borderRadius: 999, color: `${fg}B3` }}>{f}</span>
              ))}
            </div>
          )}
        </FadeUp>
      </div>
    </section>
  )
}
