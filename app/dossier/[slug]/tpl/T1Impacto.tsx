'use client'
// Template 1 — ⚡ Impacto Directo
// Dark luxury hotel · Conversión inmediata · Venue presentation completo
// Secciones: Hero → Historia → Galería → Espacios → Paquetes → Temporadas
//            → Qué incluye → Testimoniales → Colaboradores → Extras → FAQ → CTA

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate, formatPrice, isDark, toRgb, FadeUp, FadeIn, extractData, FloatingWhatsApp, AvailabilityBanner, Gallery, GalleryMosaic, GalleryGrid, IcoPin, IcoCalendar, IcoUsers, IcoBuilding, formatZoneCapacities, formatZoneFeatures, formatZonePrice, ivaLabel, VenueRentalGrid, InclusionIcon, InclusionsGrid, InclusionsList, InclusionsCards, TestimonialsCards, TestimonialsQuotes, TestimonialsCompact, TestimonialsFeatured, FaqAccordion, FaqCards, FaqNumbered, PricingCards, PricingTable, StarRating, resolveContact, replacePlaceholders, ZoneSlider, type ProposalData } from './shared'
import InquiryForm from '@/components/InquiryForm'
import VisitBookingModal from '@/components/VisitBookingModal'
import { buildSingleFontUrl } from '@/lib/fonts'
import dynamic from 'next/dynamic'

const VenueMap = dynamic(() => import('@/components/VenueMap'), { ssr: false })
import { WeddingProposal, type CartSummary } from './WeddingProposal'
import SpaceGroupSelector, { type SpaceSelection } from './SpaceGroupSelector'
import DateSelector from './DateSelector'
import { getActiveStyle, isSectionGroupEnabled } from '@/lib/section-styles'


function BudgetRequestForm({ proposalId, selectedSpaces, selectedMenus, selectedExtraSvcs, menuCart, guestCount, weddingDate, primary, btnTextColor, dark, fg, onSuccess, onClose }: {
  proposalId: string; selectedSpaces: any[]; selectedMenus: string[]; selectedExtraSvcs: string[]
  menuCart?: CartSummary | null; guestCount?: number; weddingDate?: string
  primary: string; btnTextColor: string; dark: boolean; fg: (a: number) => string
  onSuccess: () => void; onClose: () => void
}) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`/api/dossier/${proposalId}/budget-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message || null,
          selected_spaces: selectedSpaces,
          selected_menus: selectedMenus,
          selected_extra_svcs: selectedExtraSvcs,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al enviar'); setSubmitting(false); return }
      onSuccess()
    } catch { setError('Error de conexión'); setSubmitting(false) }
  }

  const effectiveGuests = menuCart?.guests || guestCount
  const hasSelections = selectedSpaces.length > 0 || (menuCart && menuCart.menuItems.length > 0) || selectedMenus.length > 0 || selectedExtraSvcs.length > 0 || (menuCart && menuCart.extras.length > 0) || !!weddingDate || !!effectiveGuests
  const cardStyle: React.CSSProperties = { background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', border: `1px solid ${fg(.08)}`, borderRadius: 10, padding: '12px 16px' }
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: fg(.35), textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }

  const formatWeddingDate = (iso?: string) => {
    if (!iso) return null
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Help text */}
      <div style={{ fontSize: 12, color: fg(.45), lineHeight: 1.5 }}>
        Si queréis cambiar algo, cerrad este modal y modificadlo en el dosier.
      </div>

      {/* Summary of selections — cart style */}
      {hasSelections && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Wedding date */}
          {weddingDate && (
            <div style={cardStyle}>
              <div style={labelStyle}>Fecha de la boda</div>
              <div style={{ fontSize: 14, color: fg(.9), fontWeight: 600 }}>{formatWeddingDate(weddingDate)}</div>
            </div>
          )}
          {/* Guests */}
          {effectiveGuests && (
            <div style={cardStyle}>
              <div style={labelStyle}>Invitados</div>
              <div style={{ fontSize: 14, color: fg(.9), fontWeight: 600 }}>{effectiveGuests} personas</div>
            </div>
          )}
          {/* Spaces */}
          {selectedSpaces.length > 0 && (
            <div style={cardStyle}>
              <div style={labelStyle}>Espacios</div>
              {selectedSpaces.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: fg(.7), paddingTop: i > 0 ? 3 : 0 }}>
                  {s.group_name}: <strong style={{ color: fg(.9) }}>{s.space_name}</strong>
                </div>
              ))}
            </div>
          )}
          {/* Menus — rich detail from cart */}
          {menuCart && menuCart.menuItems.length > 0 ? (
            <div style={cardStyle}>
              <div style={labelStyle}>Menú{menuCart.menuItems.length > 1 ? 's' : ''}</div>
              {menuCart.menuItems.map((m, i) => (
                <div key={i} style={{ marginTop: i > 0 ? 10 : 0, paddingTop: i > 0 ? 10 : 0, borderTop: i > 0 ? `1px solid ${fg(.08)}` : 'none' }}>
                  <div style={{ fontSize: 14, color: fg(.9), fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: fg(.5), marginTop: 2 }}>{m.guests} pers.</div>
                  {m.courseSelections.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {m.courseSelections.map((cs, ci) => (
                        <div key={ci} style={{ fontSize: 12, color: fg(.65) }}>{cs}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : selectedMenus.length > 0 && (
            <div style={cardStyle}>
              <div style={labelStyle}>Menú{selectedMenus.length > 1 ? 's' : ''}</div>
              {selectedMenus.map((m, i) => (
                <div key={i} style={{ fontSize: 13, color: fg(.9), fontWeight: 500, paddingTop: i > 0 ? 3 : 0 }}>{m}</div>
              ))}
            </div>
          )}
          {/* Menu extras from cart */}
          {menuCart && menuCart.extras.length > 0 && (
            <div style={cardStyle}>
              <div style={labelStyle}>Extras del menú</div>
              {menuCart.extras.map((e, i) => (
                <div key={i} style={{ fontSize: 13, color: fg(.7), paddingTop: i > 0 ? 3 : 0 }}>
                  {e.category}: <strong style={{ color: fg(.9) }}>{e.name}</strong>{e.guests ? <span style={{ color: fg(.5) }}> · {e.guests} pers.</span> : null}
                </div>
              ))}
            </div>
          )}
          {/* Extra services */}
          {selectedExtraSvcs.length > 0 && (
            <div style={cardStyle}>
              <div style={labelStyle}>Servicios adicionales</div>
              {selectedExtraSvcs.map((s, i) => (
                <div key={i} style={{ fontSize: 13, color: fg(.9), fontWeight: 500, paddingTop: i > 0 ? 3 : 0 }}>{s}</div>
              ))}
            </div>
          )}
          {/* Total */}
          {menuCart && menuCart.total > 0 && (
            <div style={{ ...cardStyle, background: `${primary}12`, border: `1px solid ${primary}33`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, color: fg(.7), fontWeight: 600 }}>Total menú estimado</div>
              <div style={{ fontSize: 15, color: primary, fontWeight: 700 }}>{menuCart.total.toLocaleString('es-ES')} €</div>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: fg(.4), display: 'block', marginBottom: 4 }}>Dudas o comentarios (opcional)</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="¿Alguna pregunta sobre el presupuesto?"
          rows={3}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: `1px solid ${fg(.12)}`, background: dark ? 'rgba(255,255,255,0.05)' : '#f9f9f9', color: fg(.85), fontSize: '.85rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>
      {error && <div style={{ fontSize: '.8rem', color: '#ef4444', marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: `1px solid ${fg(.12)}`, background: 'transparent', color: fg(.5), fontSize: '.85rem', fontWeight: 600, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={submit} disabled={submitting} style={{ flex: 2, padding: '10px 16px', borderRadius: 8, border: 'none', background: primary, color: btnTextColor, fontSize: '.85rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Enviando…' : 'Enviar solicitud'}
        </button>
      </div>
    </div>
  )
}

function EmptySec({ label: _label }: { label: string }) {
  return null
}

export default function T1Impacto({ data }: { data: ProposalData }) {
  const _preview = !!(data as any)._preview
  const { couple_name, personal_message, guest_count, wedding_date,
          price_estimate, show_price_estimate, venue, branding } = data
  const extracted = useMemo(() => extractData(data), [data])
  const { sec, on, hasCatering, packagesShow, inclusionsShow, extrasShow, faqShow,
          testsShow, zonesShow, zonesMode, seasonsShow, collabsShow, menuShow,
          menusStructured, menuExtras, appetizersBase,
          expShow, techspecs, accom, spaceGroups, dateSlots } = extracted

  // Use template default message as fallback when no personal message yet
  const displayMsg = replacePlaceholders(personal_message || (sec as any).welcome_default || null, data)

  // Pick exactly one welcome variant via the central style registry.
  // Reads `sections.styles.welcome` first, falls back to legacy
  // `sections_enabled.welcome_light` flags. Null when the group is off.
  const welcomeStyleToLegacy: Record<string, 'welcome' | 'welcome_light' | 'welcome_split' | 'welcome_editorial'> = {
    default: 'welcome',
    light: 'welcome_light',
    split: 'welcome_split',
    editorial: 'welcome_editorial',
  }
  const activeWelcomeVariant: 'welcome' | 'welcome_light' | 'welcome_split' | 'welcome_editorial' | null =
    isSectionGroupEnabled(sec, 'welcome')
      ? (welcomeStyleToLegacy[getActiveStyle(sec, 'welcome')] ?? 'welcome')
      : null

  const primary = branding?.primary_color ?? '#8B6914'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#ffffff' : '#111111'
  const logo    = branding?.logo_url ?? null
  const FONT    = (branding as any)?.font_family || "'Satoshi', Georgia, serif"
  const contact = resolveContact(data)
  const contactOn = !!(contact.phone || contact.email)
  const waHref = contact.phone ? `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, he visto la propuesta para ${couple_name} y me gustaría hablar con vosotros.`)}` : ''
  const mailHref = contact.email ? `mailto:${contact.email}?subject=${encodeURIComponent(`Propuesta ${couple_name}`)}` : ''
  const scrollToContact = () => {
    const target = on('schedule_visit') ? 'sec-schedule' : 't1-cta'
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' })
  }

  const navRef = useRef<HTMLElement>(null)
  const sbarRef = useRef<HTMLDivElement>(null)
  const [openFaq, setOpenFaq]       = useState<number | null>(null)
  const [selectedSpaces, setSelectedSpaces] = useState<SpaceSelection[]>([])
  const [selectedDatePriceIdx, setSelectedDatePriceIdx] = useState<number | null>(null)
  const guests = guest_count ? Number(guest_count) : undefined
  const visibleSpaceGroups = (spaceGroups ?? []).filter(g => {
    if (guests === undefined) return true
    if (g.min_guests && guests < g.min_guests) return false
    if (g.max_guests && guests > g.max_guests) return false
    return true
  })
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone, setVisitDone]           = useState(false)
  const [budgetRequestOpen, setBudgetRequestOpen] = useState(false)
  const [budgetRequestDone, setBudgetRequestDone] = useState(false)
  const [selectedDateSlotIdx, setSelectedDateSlotIdx] = useState<number | null>(
    // Auto-select when single date slot
    dateSlots && dateSlots.length === 1 ? 0 : null
  )
  const [selectedExtraSvcs, setSelectedExtraSvcs] = useState<Record<string, boolean>>({})
  const [selectedZoneSupplements, setSelectedZoneSupplements] = useState<Record<number, boolean>>({})
  const [selectedAccomRooms, setSelectedAccomRooms] = useState<Record<number, number>>({})
  const [selectedMenus, setSelectedMenus] = useState<string[]>([])
  const [menuTotal, setMenuTotal] = useState(0)
  const [menuValidationErrors, setMenuValidationErrors] = useState<string[]>([])
  const menuCartRef = useRef<CartSummary | null>(null)
  const setMenuCart = (c: CartSummary) => { menuCartRef.current = c }
  const [validationError, setValidationError] = useState<string | null>(null)
  // Collaborator own-provider selections: { [category]: { useOwn: bool, providerName: string } }
  const [ownProviders, setOwnProviders] = useState<Record<string, { useOwn: boolean; providerName: string }>>({})
  const [providerSubmitting, setProviderSubmitting] = useState(false)
  const [providerSubmitted, setProviderSubmitted] = useState(false)

  const submitOwnProviders = async () => {
    const active = Object.entries(ownProviders).filter(([, v]) => v.useOwn)
    if (active.length === 0) return
    setProviderSubmitting(true)
    try {
      const cm: any = (sec as any).collaborators_meta ?? {}
      const selections = active.map(([key, val]) => {
        if (key === '__generic_exclusivity') {
          return { category: 'Proveedor externo', provider_name: val.providerName || undefined, type: 'generic' as const, price: cm.generic_exclusivity_price }
        }
        const collab = collabsShow.find((c: any) => (c.category || `collab-${collabsShow.indexOf(c)}`) === key)
        return { category: key, provider_name: val.providerName || undefined, type: 'per_collaborator' as const, price: collab?.exclusivity_price }
      })
      await fetch(`/api/dossier/${data.id}/provider-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections, couple_name: data.couple_name }),
      })
      setProviderSubmitted(true)
    } catch (e) { console.error(e) }
    setProviderSubmitting(false)
  }

  // Dynamic price: updates when couple selects a date slot
  const selectedSlot = selectedDateSlotIdx !== null && dateSlots ? dateSlots[selectedDateSlotIdx] : null
  const displayPrice = selectedSlot?.price_rental
    ? parseInt(selectedSlot.price_rental.replace(/\D/g, '')) || price_estimate
    : price_estimate
  const heroRef                     = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY
      // Direct DOM updates — no React re-render on scroll
      if (navRef.current) {
        const shouldScroll = y > 60
        navRef.current.classList.toggle('scrolled', shouldScroll)
      }
      if (sbarRef.current) {
        const shouldShow = y > window.innerHeight * 0.6
        sbarRef.current.classList.toggle('active', shouldShow)
      }
      if (heroRef.current) heroRef.current.style.transform = `translateY(${y * 0.22}px)`
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  // Load branded font from Google Fonts — preload + wait before showing text
  const [fontReady, setFontReady] = useState(false)
  useEffect(() => {
    const url = buildSingleFontUrl(FONT)
    if (!url) { setFontReady(true); return }
    setFontReady(false)
    // Insert stylesheet
    const ex = document.querySelector('link[data-gf-p]') as HTMLLinkElement | null
    if (ex) { ex.href = url } else { const l = document.createElement('link'); l.rel='stylesheet'; l.href=url; l.setAttribute('data-gf-p','1'); document.head.appendChild(l) }
    // Wait for the actual font face to finish loading
    const fontName = FONT.replace(/["']/g, '').split(',')[0].trim()
    let cancelled = false
    const check = () => {
      try { return document.fonts.check(`16px "${fontName}"`) } catch { return false }
    }
    // Immediate check (font may be cached)
    if (check()) { setFontReady(true); return }
    // Use document.fonts.load() to actively trigger + await the font
    document.fonts.load(`16px "${fontName}"`).then(() => {
      if (!cancelled) setFontReady(true)
    }).catch(() => {
      if (!cancelled) setFontReady(true) // show fallback font on error
    })
    // Safety timeout — show text after 2s max even if font hasn't loaded
    const tm = setTimeout(() => { if (!cancelled) setFontReady(true) }, 2000)
    return () => { cancelled = true; clearTimeout(tm) }
  }, [FONT])

  const photos       = venue?.photo_urls ?? []
  const hero         = sec.hero_image_url ?? photos[0] ?? ''
  const galleryPhotos = sec.gallery_urls?.length ? sec.gallery_urls : photos.slice(2, 7)
  const pkgs    = packagesShow.filter((p: any) => p.is_active !== false)
  const wDate   = formatDate(wedding_date)

  // ── Color mode (dark = original, light = light luxury) ───────────────────
  const lightMode: boolean = (sec as any).color_mode === 'light'
  const pal = lightMode
    ? {
        // Warm layered creams — like fine aged paper, subtle distinction between layers
        bg: '#F6F1E7',           // warm cream page bg
        surface: '#FCF8EF',      // ivory cards
        surfaceAlt: '#EFE7D5',   // sand-toned alt (story, cta)
        surfaceDeep: '#E2D7BF',  // deep sand (footer)
        text: '#2A2520',         // warm dark (not stark black)
        borderHard: 'rgba(74,52,20,.09)',
        borderHardStrong: 'rgba(74,52,20,.16)',
        navBgScrolled: 'rgba(252,248,239,.92)',
        heroFade: '#F6F1E7',
        hoverSurface: '#F8F2E5',
        welcomeLightBg: '#F0E9DB',
        welcomeSplitTextBg: '#FCF8EF',
        cardShadow: '0 1px 2px rgba(74,52,20,.04), 0 8px 32px -12px rgba(74,52,20,.10)',
      }
    : {
        bg: '#0A0A0A', surface: '#111111', surfaceAlt: '#0E0E0E', surfaceDeep: '#000000',
        text: '#FFFFFF',
        borderHard: '#181818', borderHardStrong: '#222222',
        navBgScrolled: 'rgba(10,10,10,.97)', heroFade: '#0A0A0A',
        hoverSurface: '#151515',
        welcomeLightBg: '#f8f4ee', welcomeSplitTextBg: '#FFFFFF',
        cardShadow: 'none',
      }
  // foreground (text/border) with opacity — warm-tinted in light mode
  const fg = (o: number) => lightMode ? `rgba(42,37,32,${o})` : `rgba(255,255,255,${o})`

  const css = useMemo(() => `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth} body{-webkit-font-smoothing:antialiased}
    ::selection{background:rgba(${rgb},.25)}

    .t1{font-family:'Inter',system-ui,sans-serif;background:${pal.bg};color:${pal.text};overflow-x:hidden}

    /* Layout helpers */
    .w{max-width:1100px;margin:0 auto;padding:0 48px}
    .w-sm{max-width:760px;margin:0 auto;padding:0 48px}

    /* ── Sticky nav ── */
    .t1-nav{
      position:fixed;top:0;left:0;right:0;z-index:200;
      display:flex;align-items:center;justify-content:space-between;
      padding:0 48px;height:64px;
      background:transparent;
      opacity:0;pointer-events:none;
      transition:background .4s,box-shadow .4s,opacity .4s;
    }
    .t1-nav.scrolled{background:${pal.navBgScrolled};box-shadow:0 1px 0 ${fg(.06)};opacity:1;pointer-events:auto}
    .t1-nav-logo{font-family:${FONT};font-size:1rem;font-weight:400;color:${fg(.5)};letter-spacing:.04em}
    .t1-nav-cta{
      background:${primary};color:${onPri};border:none;
      padding:9px 24px;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
      cursor:pointer;transition:opacity .2s;
    }
    .t1-nav-cta:hover{opacity:.82}

    /* ── Sticky bottom bar ── */
    .t1-sbar{
      position:fixed;bottom:0;left:0;right:0;z-index:200;
      background:${primary};color:${(sec as any).sbar_text_color || onPri};
      display:flex;align-items:center;justify-content:space-between;
      padding:14px 48px;
      box-shadow:0 -2px 20px rgba(0,0,0,.15);
      transform:translateY(100%);
      transition:transform .4s cubic-bezier(.22,1,.36,1);
    }
    .t1-sbar.active{transform:translateY(0)}

    /* ── Hero ── */
    .t1-hero{position:relative;height:100svh;min-height:620px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;background:${pal.bg}}
    .t1-hero-img{position:absolute;inset:0;width:100%;height:120%;object-fit:cover;object-position:center 20%;transform-origin:center top}
    .t1-hero-overlay{position:absolute;inset:0}
    @keyframes zoom{from{transform:scale(1.0) translateY(0)}to{transform:scale(1.0) translateY(0)}}
    @keyframes hf{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
    .ha{animation:hf .9s ease both}

    /* ── Stats bar ── */
    .t1-stats{display:flex;background:${pal.surface};border-bottom:1px solid ${pal.borderHard}}
    .t1-stat{flex:1;padding:32px 24px 28px;border-right:1px solid ${pal.borderHard};text-align:center}
    .t1-stat:last-child{border-right:none}
    .t1-stat:first-child{text-align:left;padding-left:48px;flex:1.2}
    .t1-stat-n{font-family:${FONT};font-size:2.4rem;font-weight:300;color:${primary};line-height:1;display:block;letter-spacing:-.02em}
    .t1-stat-l{font-size:.6rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:${fg(.28)};margin-top:8px;display:block}

    /* ── Sections base ── */
    .t1-sec{padding:88px 0;border-top:1px solid ${pal.borderHard}}
    .t1-sec:nth-of-type(odd){padding:104px 0}
    .t1-label{font-size:.6rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${primary};margin-bottom:12px;display:block}
    .t1-h2{font-family:${FONT};font-size:clamp(1.9rem,3.6vw,3.2rem);font-weight:300;color:${pal.text};line-height:1.1;margin-bottom:48px;letter-spacing:-.01em}
    .t1-line{width:36px;height:1.5px;background:${primary};margin:18px 0 40px}

    /* ── Empty section placeholder (preview-only) ── */
    .t1-empty{padding:14px 22px;border:1.5px dashed ${fg(.2)};border-radius:10px;color:${fg(.42)};font-size:12px;display:flex;align-items:center;gap:8px}
    .t1-empty-plus{font-size:15px;opacity:.55}
    .t1-empty-lbl{color:${fg(.6)};font-weight:600}

    /* ── Story section ── */
    .t1-story{display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:stretch}
    .t1-story>*{display:flex;flex-direction:column}
    .t1-story-text{padding:80px 64px;background:${pal.surfaceAlt};display:flex;flex-direction:column;justify-content:center;flex:1;box-sizing:border-box}
    .t1-story-body{font-size:.95rem;color:${fg(.52)};line-height:1.9;white-space:pre-wrap;margin-top:4px;overflow-wrap:break-word}
    .t1-story-img{overflow:hidden;min-height:500px;position:relative;background:${pal.surfaceAlt}}
    .t1-story-img img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(${lightMode ? '.97' : '.82'})}
    @media(max-width:900px){.t1-story-text{padding:48px 28px}.t1-story-img{min-height:260px;aspect-ratio:16/10}}

    /* ── Gallery mosaic ── */
    .t1-mosaic{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:340px 260px;gap:2px;background:${fg(.04)}}
    .t1-mosaic-item{overflow:hidden;position:relative}
    .t1-mosaic-item img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(${lightMode ? '.95' : '.78'});transition:transform .6s ease,filter .3s}
    .t1-mosaic-item:hover img{transform:scale(1.03);filter:brightness(${lightMode ? '1' : '.9'})}
    .t1-mosaic-item.span-2{grid-row:span 2}

    /* ── Zones / Spaces ── */
    .t1-zones{display:flex;flex-direction:column;gap:${lightMode ? '1px' : '0'};max-width:1200px;margin:0 auto;background:${fg(.06)}}
    .t1-zone{display:grid;grid-template-columns:1fr 1fr;background:${pal.surface};overflow:hidden;align-items:stretch;border-radius:0}
    .t1-zone-reverse .t1-zone-img{order:2}
    .t1-zone-reverse .t1-zone-info{order:1}
    .t1-zone-img{position:relative;overflow:hidden;min-height:380px;height:100%;background:${pal.surfaceAlt}}
    .t1-zone-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;filter:brightness(${lightMode ? '.97' : '.82'})}
    .t1-zone-ph{width:100%;height:100%;background:${pal.surfaceAlt};display:flex;align-items:center;justify-content:center;opacity:.3}
    .t1-zone-info{padding:60px 56px;display:flex;flex-direction:column;gap:14px;justify-content:center}
    .t1-zone-name{font-family:${FONT};font-size:1.9rem;font-weight:300;color:${pal.text};line-height:1.15;letter-spacing:-.01em}
    .t1-zone-desc{font-size:.88rem;color:${fg(.48)};line-height:1.85}
    .t1-zone-cap{font-size:.72rem;font-weight:600;letter-spacing:.08em;color:${fg(.4)};text-transform:uppercase}
    .t1-zone-price{font-size:.85rem;color:${fg(.32)}}

    /* ── Packages ── */
    .t1-pkgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:${lightMode ? '1px' : '1px'};background:${fg(.06)}}
    .t1-pkg{background:${pal.surface};padding:44px 36px;display:flex;flex-direction:column;transition:background .25s;border-radius:0}
    .t1-pkg:hover{background:${pal.hoverSurface}}
    .t1-pkg.rec{border-top:2px solid ${primary}}
    .t1-pkg-badge{display:inline-flex;align-items:center;gap:6px;font-size:.55rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${primary};background:none;padding:0;border-radius:0;margin-bottom:14px;align-self:flex-start}
    .t1-pkg-badge::before{content:'—';color:${primary};font-weight:300}
    .t1-pkg-name{font-family:${FONT};font-size:1.6rem;font-weight:300;color:${pal.text};margin-bottom:4px}
    .t1-pkg-sub{font-size:.76rem;color:${fg(.35)};margin-bottom:20px}
    .t1-pkg-price{font-family:${FONT};font-size:clamp(2.6rem,4.5vw,3.8rem);font-weight:300;color:${primary};line-height:1;margin:8px 0 28px}
    .t1-pkg-price small{font-size:.9rem;color:${fg(.3)};font-family:'Inter',sans-serif;font-weight:300}
    .t1-pkg-includes{list-style:none;display:flex;flex-direction:column;gap:8px;flex:1}
    .t1-pkg-includes li{font-size:.8rem;color:${fg(.55)};display:flex;align-items:flex-start;gap:10px}
    .t1-pkg-includes li::before{content:'';width:12px;height:1px;background:${fg(.15)};flex-shrink:0;margin-top:9px}
    .t1-pkg-guests{margin-top:20px;padding-top:18px;border-top:1px solid ${fg(.06)};font-size:.75rem;color:${fg(.25)}}

    /* ── Season pricing ── */
    .t1-seasons{display:flex;flex-direction:column;gap:0;border-top:1px solid ${fg(.06)}}
    .t1-season{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center;padding:24px 32px;background:transparent;gap:24px;transition:background .2s;border-bottom:1px solid ${fg(.06)};border-radius:0}
    .t1-season:hover{background:${fg(.02)}}
    .t1-season.alta{border-left:2px solid ${primary};background:${fg(.02)}}
    .t1-season-lbl{font-family:${FONT};font-size:1.05rem;font-weight:400;color:${pal.text}}
    .t1-season-dates{font-size:.82rem;color:${fg(.4)};line-height:1.6}
    .t1-season-price{font-family:${FONT};font-size:1.25rem;font-weight:300;color:${primary};text-align:right}

    /* ── Inclusions ── */
    .t1-inc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1px;align-items:stretch;background:${fg(.06)}}
    .t1-inc-grid > *{height:100%}
    .t1-inc{display:flex;align-items:flex-start;gap:16px;padding:28px 24px;border:none;border-radius:0;background:${lightMode ? pal.bg : pal.surfaceAlt};transition:background .25s;height:100%}
    .t1-inc:hover{background:${lightMode ? pal.surface : fg(.04)}}
    .t1-inc-emoji{flex-shrink:0;margin-top:2px;width:32px;height:32px;border-radius:6px;background:${fg(.04)};display:flex;align-items:center;justify-content:center}
    .t1-inc-title{font-size:.88rem;font-weight:600;color:${fg(.85)};margin-bottom:4px;letter-spacing:.01em}
    .t1-inc-desc{font-size:.78rem;color:${fg(.45)};line-height:1.6}

    /* ── Menu ── */
    .t1-menu-row{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid ${pal.borderHard};gap:20px}
    .t1-menu-name{font-family:${FONT};font-size:1.2rem;font-weight:400;color:${pal.text}}
    .t1-menu-desc{font-size:.8rem;color:${fg(.45)};margin-top:3px;line-height:1.5}
    .t1-menu-price{font-family:${FONT};font-size:1.6rem;font-weight:300;color:${primary};white-space:nowrap}

    /* ── Testimonials ── */
    .t1-tests{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:0 1px;align-items:stretch;background:${fg(.06)}}
    .t1-tests > *{height:100%}
    .t1-test{background:${pal.surface};display:flex;flex-direction:column;padding:36px 32px 32px;border-radius:0;border:none;transition:background .25s;height:100%;gap:16px;position:relative;overflow:hidden}
    .t1-test:hover{background:${pal.hoverSurface}}
    .t1-test-qmark{display:none}
    .t1-test-stars{color:${primary};font-size:.7rem;letter-spacing:1px;display:flex;align-items:center;gap:3px;position:relative;z-index:1}
    .t1-test-text{font-family:${FONT};font-style:italic;font-size:1rem;line-height:1.8;color:${fg(.65)};flex:1;position:relative;z-index:1;padding-left:0;border-left:none}
    .t1-test-foot{display:flex;flex-direction:column;gap:2px;padding-top:16px;border-top:none;margin-top:auto;position:relative;z-index:1}
    .t1-test-couple{font-size:.82rem;font-weight:600;color:${pal.text};letter-spacing:.02em}
    .t1-test-date{font-size:.68rem;color:${fg(.35)};font-weight:400;letter-spacing:.06em;text-transform:uppercase}

    /* ── Collaborators ── */
    .t1-collabs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1px;align-items:stretch;background:${fg(.06)}}
    .t1-collabs-grid > *{height:100%}
    .t1-collab{background:${pal.surface};padding:28px 24px;height:100%;display:flex;flex-direction:column;gap:2px;border-radius:0;border:none;transition:background .2s}
    .t1-collab:hover{background:${pal.hoverSurface}}
    .t1-collab-exclusive{border-left:2px solid ${primary}}
    .t1-collab-badge{display:inline-flex;align-items:center;gap:4px;font-size:.55rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${primary};background:${fg(.04)};padding:3px 10px;border-radius:0;margin-bottom:10px;width:fit-content}
    .t1-collab-cat{font-size:.58rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${fg(.3)};margin-bottom:8px}
    .t1-collab-name{font-size:.95rem;font-weight:600;color:${fg(.85)};margin-bottom:4px}
    .t1-collab-desc{font-size:.78rem;color:${fg(.42)};line-height:1.65}
    .t1-collab-price{font-size:.75rem;color:${fg(.5)};margin-top:8px;font-style:italic;padding-top:8px;border-top:1px solid ${fg(.06)}}
    .t1-collab-links{display:flex;gap:12px;margin-top:auto;padding-top:14px;flex-wrap:wrap}
    .t1-collab-links a{font-size:.72rem;color:${primary};text-decoration:none;display:inline-flex;align-items:center;gap:3px;transition:opacity .15s}
    .t1-collab-links a:hover{opacity:.7}
    .t1-collab-excl-price{font-size:.72rem;font-weight:600;color:${primary};margin-top:10px;padding:8px 12px;background:${lightMode ? 'rgba(196,151,90,0.08)' : 'rgba(255,255,255,0.05)'};border-radius:8px;border:1px dashed ${primary}40}
    .t1-collab-own-btn{font-size:.72rem;color:${fg(.45)};margin-top:6px;padding:6px 10px;background:none;border:1px solid ${fg(.1)};border-radius:6px;cursor:pointer;transition:all .2s;width:100%;text-align:left}
    .t1-collab-own-btn:hover{border-color:${primary};color:${primary}}
    .t1-collab-own-active{border-color:${primary};background:${lightMode ? 'rgba(196,151,90,0.06)' : 'rgba(255,255,255,0.04)'}}
    .t1-collab-own-input{margin-top:6px;width:100%;padding:8px 10px;font-size:.78rem;border:1px solid ${fg(.1)};border-radius:6px;background:${lightMode ? '#fff' : '#111'};color:${fg(.8)};outline:none;font-family:inherit}
    .t1-collab-own-input:focus{border-color:${primary}}
    .t1-collab-generic-price{margin-top:32px;padding:20px 24px;background:${lightMode ? pal.surfaceAlt : '#0a0a0a'};border-radius:12px;border:1px solid ${fg(.08)};text-align:center}

    /* ── Extra services ── */
    .t1-extra-row{display:flex;justify-content:space-between;align-items:center;padding:20px 0;border-bottom:1px solid ${fg(.05)};gap:24px}
    .t1-extra-name{font-size:.9rem;font-weight:500;color:${fg(.78)}}
    .t1-extra-desc{font-size:.76rem;color:${fg(.38)};margin-top:3px;line-height:1.5}
    .t1-extra-price{font-family:${FONT};font-size:1.3rem;font-weight:300;color:${primary};white-space:nowrap}

    /* ── Message ── */
    .t1-msg{max-width:620px;margin:0 auto;text-align:center;padding:24px 48px}
    .t1-msg-qmark{display:none}
    .t1-msg-text{font-family:${FONT};font-size:clamp(1.05rem,2vw,1.25rem);font-style:italic;font-weight:300;color:${fg(.62)};line-height:1.85;white-space:pre-wrap}
    .t1-msg-sig{margin-top:20px;font-size:.6rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${fg(.25)}}

    /* ── FAQ ── */
    .t1-faq-item{border-bottom:1px solid ${fg(.06)}}
    .t1-faq-q{width:100%;display:flex;justify-content:space-between;align-items:center;padding:22px 0;background:none;border:none;cursor:pointer;text-align:left;gap:20px}
    .t1-faq-q-text{font-size:.92rem;font-weight:500;color:${fg(.72)}}
    .t1-faq-q.open .t1-faq-q-text{color:${pal.text}}
    .t1-faq-plus{font-size:1.2rem;font-weight:300;color:${fg(.3)};flex-shrink:0;transition:transform .25s}
    .t1-faq-a{overflow:hidden;transition:max-height .4s cubic-bezier(.22,1,.36,1)}
    .t1-faq-a-inner{font-size:.85rem;color:${fg(.48)};line-height:1.85;padding-bottom:22px}

    /* ── Accommodation ── */
    .t1-accom{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start}
    .t1-accom-rooms-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
    .t1-accom-room{display:flex;align-items:center;gap:12px;font-size:.86rem;color:${fg(.5)}}
    .t1-accom-room::before{content:'';width:10px;height:1px;background:${fg(.15)};flex-shrink:0}

    /* ── CTA section ── */
    .t1-cta{background:${pal.surfaceAlt};padding:100px 0;border-top:1px solid ${fg(.08)}}

    /* ── Sticky nav links ── */
    .t1-nav-links{display:none;align-items:center;gap:24px}
    .t1-nav.scrolled .t1-nav-links{display:flex}
    .t1-nav-link{font-size:.64rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${fg(.45)};cursor:pointer;transition:color .2s;background:none;border:none;padding:0;white-space:nowrap}
    .t1-nav-link:hover{color:${fg(.85)}}

    /* ── Welcome light (always cream/warm) ── */
    .t1-wl{padding:56px 0;background:${pal.welcomeLightBg};position:relative;overflow:hidden}
    .t1-wl-bg{position:absolute;inset:0;object-fit:cover;width:100%;height:100%;opacity:.08;filter:blur(8px) saturate(.4)}
    .t1-wl-inner{position:relative;z-index:1;max-width:640px;margin:0 auto;padding:0 48px;text-align:center}
    .t1-wl-line{width:28px;height:1px;background:${fg(.15)};margin:0 auto 28px}
    .t1-wl-body{font-family:${FONT};font-size:clamp(1.05rem,2vw,1.3rem);font-style:italic;font-weight:300;color:#3a3530;line-height:1.9;white-space:pre-wrap}
    .t1-wl-sig{margin-top:24px;font-size:.6rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${fg(.3)}}

    /* ── Welcome split ── */
    .t1-ws{display:grid;grid-template-columns:1fr 1fr;align-items:stretch}
    .t1-ws>*{min-height:0}
    .t1-ws-img{overflow:hidden;position:relative;background:${pal.surfaceAlt};order:0;min-height:320px}
    .t1-ws-img.right{order:1}
    .t1-ws-img img{width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0}
    .t1-ws-text{background:${pal.welcomeSplitTextBg};padding:48px 56px;display:flex;flex-direction:column;justify-content:center;order:0}
    .t1-ws-text.after-img{order:1}
    .t1-ws-eyebrow{font-size:.58rem;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:${fg(.3)};margin-bottom:16px;display:block}
    .t1-ws-body{font-family:${FONT};font-size:clamp(1rem,1.8vw,1.2rem);font-style:italic;font-weight:300;color:#3a3530;line-height:1.85;white-space:pre-wrap}
    .t1-ws-sig{margin-top:20px;font-size:.6rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:${fg(.25)}}
    @media(max-width:780px){.t1-ws{grid-template-columns:1fr}.t1-ws-img{min-height:260px;order:0!important}.t1-ws-text{order:1!important;padding:32px 24px}}

    /* ── Welcome editorial ── */
    .t1-we{background:${pal.bg};padding:56px 0;border-top:1px solid ${fg(.06)}}
    .t1-we-inner{max-width:900px;margin:0 auto;padding:0 48px}
    .t1-we-eyebrow{font-size:.58rem;font-weight:600;letter-spacing:.26em;text-transform:uppercase;color:${fg(.3)};margin-bottom:36px;display:block}
    .t1-we-body{font-family:${FONT};font-size:clamp(1.4rem,3vw,2.4rem);font-weight:300;color:${fg(.85)};line-height:1.45;font-style:italic;white-space:pre-wrap}
    .t1-we-sig{margin-top:32px;padding-top:0;border-top:none;font-size:.6rem;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${fg(.25)}}

    /* ── Schedule visit ── */
    .t1-sv{background:${pal.surface};padding:80px 0;border-top:1px solid ${fg(.06)}}
    .t1-sv-inner{max-width:600px;margin:0 auto;padding:0 48px;text-align:center}
    .t1-sv-icon{width:44px;height:44px;border-radius:0;background:none;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;border:none;opacity:.5}
    .t1-sv-title{font-family:${FONT};font-size:clamp(1.5rem,2.8vw,2.2rem);font-weight:300;color:${pal.text};margin-bottom:14px;line-height:1.2}
    .t1-sv-sub{font-size:.86rem;color:${fg(.45)};line-height:1.8;margin-bottom:36px}
    .t1-sv-btn{display:inline-block;background:${primary};color:${onPri};border:none;padding:15px 44px;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;text-decoration:none;transition:opacity .2s}
    .t1-sv-btn:hover{opacity:.85}
    .t1-sv-note{margin-top:16px;font-size:.72rem;color:${fg(.28)}}
    .t1-cta-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
    .t1-cta-h{font-family:${FONT};font-size:clamp(2rem,4.5vw,3.6rem);font-weight:300;color:${pal.text};line-height:1.1;margin-bottom:20px}
    .t1-cta-sub{font-size:.9rem;color:${fg(.45)};line-height:1.85;margin-bottom:32px}
    .t1-cta-contact div{font-size:.83rem;color:${fg(.38)};margin-bottom:8px}
    /* ── Contact section ── */
    .t1-contact-inner{max-width:560px;margin:0 auto;text-align:center}
    .t1-contact-venue-identity{margin-bottom:40px;padding-bottom:36px;border-bottom:1px solid ${fg(.08)}}
    .t1-contact-channel{display:flex;align-items:center;gap:16px;padding:20px 0;border-bottom:1px solid ${fg(.06)};text-align:left}
    .t1-contact-channel:last-of-type{border-bottom:none}
    .t1-contact-channel-icon{width:36px;height:36px;border-radius:50%;background:${fg(.05)};border:1px solid ${fg(.1)};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${primary}}
    .t1-contact-channel-info{flex:1;min-width:0}
    .t1-contact-channel-lbl{font-size:.58rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${fg(.32)};margin-bottom:5px}
    .t1-contact-channel-val{font-size:.9rem;color:${fg(.78)};font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .t1-contact-btn{background:${fg(.06)};color:${fg(.7)};border:1px solid ${fg(.1)};padding:9px 18px;font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;text-decoration:none;white-space:nowrap;transition:background .2s,color .2s;flex-shrink:0}
    .t1-contact-btn:hover{background:${fg(.1)};color:${pal.text}}
    .t1-form{display:flex;flex-direction:column;gap:20px}
    .t1-field-label{display:block;font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${fg(.32)};margin-bottom:9px}
    .t1-input{width:100%;padding:13px 0;border:none;border-bottom:1px solid ${fg(.16)};background:transparent;font-family:'Inter',sans-serif;font-size:.9rem;color:${pal.text};outline:none;transition:border-color .2s}
    .t1-input:focus{border-bottom-color:${primary}}
    .t1-input::placeholder{color:${fg(.28)}}
    .t1-btn{background:${primary};color:${onPri};border:none;padding:16px 40px;font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:opacity .2s,transform .2s;align-self:flex-start;margin-top:4px}
    .t1-btn:hover{opacity:.88;transform:translateX(3px)}
    .t1-btn:disabled{opacity:.4;cursor:default;transform:none}

    /* ── Footer ── */
    .t1-footer{background:${pal.surfaceDeep};padding:32px 48px;border-top:1px solid ${fg(.06)};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
    .t1-footer-links{display:flex;gap:24px}
    .t1-footer-links a{font-size:.72rem;color:${fg(.28)};text-decoration:none;letter-spacing:.04em;transition:color .2s}
    .t1-footer-links a:hover{color:${fg(.55)}}

    /* ── Responsive ── */
    @media(max-width:900px){
      .w,.w-sm{padding:0 24px}
      .t1-story,.t1-accom{grid-template-columns:1fr}
      .t1-story-img{min-height:280px}
      .t1-zone{grid-template-columns:1fr}
      .t1-zone:nth-child(even) .t1-zone-img,.t1-zone:nth-child(even) .t1-zone-info{order:unset}
      .t1-cta-grid{grid-template-columns:1fr}
      .t1-season{grid-template-columns:1fr 1fr;gap:12px}
      .t1-season .t1-season-price{text-align:left;grid-column:span 2}
      .t1-nav,.t1-sbar{padding-left:20px;padding-right:20px}
      .t1-nav{display:none}
      .t1-sbar{transform:translateY(0)!important}
      .t1-mosaic{grid-template-columns:1fr 1fr;grid-template-rows:auto}
      .t1-mosaic-item.span-2{grid-row:span 1}
    }
    @media(max-width:560px){
      .t1-stats{flex-wrap:wrap}
      .t1-stat{width:50%;border-right:1px solid ${pal.borderHard}}
      .t1-tests{grid-template-columns:1fr}
      .t1-pkgs{grid-template-columns:1fr}
    }
  `, [FONT, primary, rgb, onPri, lightMode])

  return (
    <div className="t1 tpl-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── NAV ── */}
      {on('sticky_nav') && (
        <nav ref={navRef} className="t1-nav">
          {logo
            ? <img src={logo} alt={venue?.name || ''} style={{ height: 28, objectFit: 'contain' }} />
            : <span className="t1-nav-logo">{venue?.name}</span>
          }
          {(() => {
            const navLinks = [
              activeWelcomeVariant && displayMsg
                ? { label: 'Bienvenida', anchor: 'sec-welcome' } : null,
              expShow && on('experience') ? { label: 'Historia', anchor: 'sec-experience' } : null,
              on('gallery') && galleryPhotos.length > 0 ? { label: 'Galería', anchor: 'sec-gallery' } : null,
              on('single_space') && (sec as any).single_space?.title ? { label: (sec as any).single_space?.subtitle || 'Vuestro espacio', anchor: 'sec-single-space' } : null,
              on('zones') && zonesShow.length > 0 ? { label: 'Espacios', anchor: 'sec-zones' } : null,
              on('space_groups') && visibleSpaceGroups.length > 0 ? { label: 'Espacios', anchor: 'sec-space-groups' } : null,
              hasCatering && on('menu') ? { label: 'Menús', anchor: 'menu' } : null,
              on('schedule_visit') ? { label: 'Agendar visita', anchor: 'sec-schedule' } : null,
              !on('schedule_visit') && contactOn ? { label: 'Contactar', anchor: 't1-cta' } : null,
            ].filter(Boolean) as { label: string; anchor: string }[]
            if (!navLinks.length) return null
            return (
              <div className="t1-nav-links">
                {navLinks.map(({ label, anchor }) => (
                  <button key={anchor} className="t1-nav-link"
                    onClick={() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' })}>
                    {label}
                  </button>
                ))}
              </div>
            )
          })()}
        </nav>
      )}

      {/* ── STICKY BAR ── */}
      {(() => {
        const sbarC = (sec as any).sbar_text_color || onPri
        const sbarBtnBg = `${sbarC}1a`
        const sbarBtnBorder = `${sbarC}33`
        return (
          <div ref={sbarRef} className="t1-sbar">
            <div>
              <div style={{ fontFamily: FONT, fontSize: '1.1rem', fontWeight: 300, fontStyle: 'italic' }}>{couple_name}</div>
              <div style={{ fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6, marginTop: 2 }}>Propuesta exclusiva · {venue?.name}</div>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              {/* Price display: menu total takes priority over static estimate */}
              {menuTotal > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                  <span style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 300 }}>{menuTotal.toLocaleString('es-ES')} €</span>
                  <span style={{ fontSize: '.6rem', opacity: .6, letterSpacing: '.06em', marginTop: 3 }}>total estimado menú</span>
                </div>
              ) : show_price_estimate && displayPrice ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
                  <span style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 300 }}>{formatPrice(displayPrice)}</span>
                  {ivaLabel(sec, true) && <span style={{ fontSize: '.65rem', opacity: .8, letterSpacing: '.08em', marginTop: 3 }}>{ivaLabel(sec, true)}</span>}
                </div>
              ) : null}
              {on('schedule_visit') ? (
                <button style={{ background: sbarBtnBg, color: sbarC, border: `1px solid ${sbarBtnBorder}`, padding: '9px 20px', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                  onClick={() => {
                    // 1. Check menu validation first (if menus exist)
                    if (hasCatering && menuValidationErrors.length > 0) {
                      setValidationError(menuValidationErrors[0])
                      // Wait a tick for the warning element to render, then scroll to it
                      setTimeout(() => {
                        const warn = document.getElementById('wp-validation-warning')
                        if (warn) warn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        else document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 50)
                      setTimeout(() => setValidationError(null), 6000)
                      return
                    }
                    // 2. Check required space groups
                    const missingGroups = (visibleSpaceGroups ?? []).filter(g => {
                      const sm = g.selection_mode
                      const isOpt = g.optional || sm === 'optional' || sm === 'optional_one' || sm === 'optional_any' || sm === 'none' || g.requires_selection === false
                      if (isOpt) return false
                      // Skip junk groups without name or spaces
                      if (!g.name || !g.name.trim()) return false
                      if (!Array.isArray((g as any).spaces) || (g as any).spaces.length === 0) return false
                      return !selectedSpaces.some(s => s.group_name === g.name)
                    })
                    if (missingGroups.length > 0) {
                      const firstIdx = visibleSpaceGroups.findIndex(g => g.name === missingGroups[0].name)
                      const el = document.getElementById(`space-group-${firstIdx}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      setValidationError(`Selecciona una opción en: ${missingGroups.map(g => g.name).join(', ')}`)
                      setTimeout(() => setValidationError(null), 6000)
                      return
                    }
                    setValidationError(null)
                    setVisitModalOpen(true)
                  }}>
                  Agendar visita →
                </button>
              ) : (hasCatering || contactOn) ? (
                <button style={{ background: sbarBtnBg, color: sbarC, border: `1px solid ${sbarBtnBorder}`, padding: '9px 20px', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}
                  onClick={() => hasCatering ? document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }) : scrollToContact()}>
                  {hasCatering ? 'Ver menús' : 'Contactar'} →
                </button>
              ) : null}
            </div>
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="t1-hero">
        {hero && (
          <>
            <img ref={heroRef} src={hero} alt="" className="t1-hero-img"
              style={{}}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
            {(() => {
              const oColor = (sec as any).hero_overlay_color ?? '#000000'
              const oAlpha = (sec as any).hero_overlay_opacity ?? 0.5
              const cr = parseInt(oColor.slice(1,3),16), cg = parseInt(oColor.slice(3,5),16), cb = parseInt(oColor.slice(5,7),16)
              const a = (f: number) => Math.min(1, oAlpha * f).toFixed(2)
              return <div className="t1-hero-overlay" style={{ background: `linear-gradient(to bottom, rgba(${cr},${cg},${cb},${a(0.3)}) 0%, rgba(${cr},${cg},${cb},${a(0)}) 30%, rgba(${cr},${cg},${cb},${a(1.4)}) 72%, rgba(${cr},${cg},${cb},${a(1.96)}) 100%)` }} />
            })()}
          </>
        )}
        {/* Content */}
        {(() => {
          const heroTitleColor = (sec as any).hero_title_color ?? '#ffffff'
          const heroSubColor = (sec as any).hero_subtitle_color ?? '#ffffff'
          const sr = parseInt(heroSubColor.slice(1,3),16), sg = parseInt(heroSubColor.slice(3,5),16), sb = parseInt(heroSubColor.slice(5,7),16)
          const subFull = heroSubColor
          const subLabel = `rgba(${sr},${sg},${sb},.6)`
          return (
            <div style={{ position: 'relative', zIndex: 10, padding: '0 48px 80px' }}>
              <div className="ha" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '7px 0', marginBottom: 24, animationDelay: '.15s' }}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '.62rem', fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.7)' }}>
                  Propuesta exclusiva
                </span>
                {venue?.name && (
                  <>
                    <span style={{ width: 16, height: 1, background: 'rgba(255,255,255,.25)' }} />
                    <span style={{ fontFamily: 'Inter,sans-serif', fontSize: '.62rem', fontWeight: 400, letterSpacing: '.06em', color: 'rgba(255,255,255,.55)' }}>{venue.name}</span>
                  </>
                )}
              </div>
              <h1 className="ha" style={{ fontFamily: FONT, fontSize: 'clamp(2.8rem,8vw,6.5rem)', fontWeight: 300, lineHeight: .95, letterSpacing: '-.02em', marginBottom: 24, animationDelay: '.35s', color: heroTitleColor, opacity: fontReady ? 1 : 0, transition: 'opacity .3s ease' }}>
                {couple_name}
              </h1>
            </div>
          )
        })()}
      </section>

      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} guestCount={guests} weddingDate={wedding_date ?? undefined} />
      )}

      {/* ════════════════════════════════════════════
          SELECTOR DE FECHAS
      ════════════════════════════════════════════ */}
      {on('date_slots') && dateSlots && dateSlots.length > 1 && !(on('space_groups') && visibleSpaceGroups.length > 0) && (
        <DateSelector
          slots={dateSlots}
          primary={primary}
          onPrimary={onPri}
          dark={!lightMode}
          font={FONT}
          proposalId={data.id}
          onSelect={setSelectedDateSlotIdx}
          guestCount={guests}
        />
      )}

      {/* ── STATS BAR ── */}
      {on('venue_specs') && (() => {
        const vs = (sec as any).venue_specs ?? {}
        // New format: stats array; fallback: legacy fields
        const items: Array<{ n: string; l: string }> = Array.isArray(vs.stats) && vs.stats.length > 0
          ? vs.stats.filter((s: any) => s.value).map((s: any) => ({ n: s.value, l: s.label }))
          : [
              { n: vs.founded_year ?? '',                                                    l: 'Año de fundación' },
              { n: vs.area ?? techspecs?.sqm?.split('·')[0]?.trim() ?? '',                   l: 'Extensión' },
              { n: vs.max_capacity ?? '',                                                    l: 'Capacidad máxima' },
              { n: vs.extra_value ?? '',                                                     l: vs.extra_label ?? 'Sola boda al día' },
            ].filter(s => s.n !== '' && s.n != null)
        if (!items.length) return null
        return (
          <div className="t1-stats">
            {items.map((s, i) => (
              <FadeIn key={i} delay={i * .08}>
                <div className="t1-stat">
                  <span className="t1-stat-n">{s.n}</span>
                  <span className="t1-stat-l">{s.l}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════
          MENSAJE PERSONAL + CONVERSION BLOCK
      ════════════════════════════════════════════ */}
      {activeWelcomeVariant === 'welcome' && displayMsg && (
        <section id="sec-welcome" className="t1-sec" style={{ background: lightMode ? pal.surface : '#080808', padding: '32px 0' }}>
          <FadeUp>
            <div className="t1-msg">
              <div className="t1-msg-qmark">"</div>
              <p className="t1-msg-text">{displayMsg}</p>
              {venue?.name && <div className="t1-msg-sig">— {venue.name}</div>}
            </div>
          </FadeUp>
        </section>
      )}

      {/* ════════════════════════════════════════════
          BIENVENIDA · FONDO CLARO
      ════════════════════════════════════════════ */}
      {activeWelcomeVariant === 'welcome_light' && displayMsg && (
        <section id="sec-welcome" className="t1-wl">
          {(sec as any).welcome_light?.image_url && (
            <img className="t1-wl-bg" src={(sec as any).welcome_light.image_url} alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          )}
          <FadeUp>
            <div className="t1-wl-inner">
              <div className="t1-wl-line" />
              <p className="t1-wl-body">{displayMsg}</p>
              {venue?.name && <div className="t1-wl-sig">— {venue.name}</div>}
            </div>
          </FadeUp>
        </section>
      )}

      {/* ════════════════════════════════════════════
          BIENVENIDA · DOS COLUMNAS
      ════════════════════════════════════════════ */}
      {activeWelcomeVariant === 'welcome_split' && displayMsg && (
        <section id="sec-welcome">
          <div className="t1-ws">
            <div className={`t1-ws-img${(sec as any).welcome_split?.image_side === 'right' ? ' right' : ''}`}>
              {(sec as any).welcome_split?.image_url && (
                <img src={(sec as any).welcome_split.image_url} alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              )}
            </div>
            <FadeUp style={{ display: 'flex' }}>
              <div className={`t1-ws-text${(sec as any).welcome_split?.image_side === 'right' ? '' : ' after-img'}`} style={{ flex: 1 }}>
                <span className="t1-ws-eyebrow">Un mensaje para vosotros</span>
                <p className="t1-ws-body">{displayMsg}</p>
                {venue?.name && <div className="t1-ws-sig">— {venue.name}</div>}
              </div>
            </FadeUp>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          BIENVENIDA · EDITORIAL
      ════════════════════════════════════════════ */}
      {activeWelcomeVariant === 'welcome_editorial' && displayMsg && (
        <section id="sec-welcome" className="t1-we">
          <FadeUp>
            <div className="t1-we-inner">
              {(sec as any).welcome_editorial?.eyebrow && (
                <span className="t1-we-eyebrow">{(sec as any).welcome_editorial.eyebrow}</span>
              )}
              <p className="t1-we-body">{displayMsg}</p>
              {venue?.name && <div className="t1-we-sig">— {venue.name}</div>}
            </div>
          </FadeUp>
        </section>
      )}

      {/* ════════════════════════════════════════════
          HISTORIA / EXPERIENCE
      ════════════════════════════════════════════ */}
      {expShow && on('experience') && (
        <section id="sec-experience" style={{ borderTop: `1px solid ${pal.borderHard}` }}>
          <div className="t1-story">
            <FadeUp>
              <div className="t1-story-text">
                <span className="t1-label">{(expShow as any).eyebrow || 'La experiencia'}</span>
                <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 300, color: pal.text, lineHeight: 1.15, marginBottom: 24 }}>
                  {expShow.title}
                </h2>
                <div className="t1-line" />
                <p className="t1-story-body">{expShow.body}</p>
              </div>
            </FadeUp>
            {((sec as any).experience_override?.image_url ?? photos[1]) && (
              <div className="t1-story-img">
                <img src={(sec as any).experience_override?.image_url ?? photos[1]} alt="El espacio" loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 32px 28px', background: 'linear-gradient(to top, rgba(0,0,0,.8), transparent)' }}>
                  <div style={{ fontFamily: FONT, fontSize: '.85rem', fontStyle: 'italic', color: 'rgba(255,255,255,.6)' }}>{venue?.name} · {venue?.city}, {venue?.region}</div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          GALERÍA MOSAICO
      ════════════════════════════════════════════ */}
      {on('gallery') && (galleryPhotos.length > 0 ? (() => {
        const galleryStyle = getActiveStyle(sec, 'gallery')
        const GalleryComp = galleryStyle === 'mosaic' ? GalleryMosaic : galleryStyle === 'grid' ? GalleryGrid : Gallery
        return (
          <FadeIn>
            <div id="sec-gallery" />
            <GalleryComp photos={galleryPhotos} primary={primary} dark={!lightMode} />
          </FadeIn>
        )
      })() : _preview ? <EmptySec label="Galería" /> : null)}

      {/* ════════════════════════════════════════════
          SINGLE SPACE (un único espacio)
      ════════════════════════════════════════════ */}
      {on('single_space') && (sec as any).single_space && (() => {
        const ss: any = (sec as any).single_space
        const features: string[] = Array.isArray(ss.features) ? ss.features : []
        const allPhotos: string[] = [
          ...(Array.isArray(ss.photos) ? ss.photos : []),
          ...(ss.image_url && !(ss.photos ?? []).includes(ss.image_url) ? [ss.image_url] : []),
        ]
        const heroImg = allPhotos[0] || (sec as any).hero_image_url
        if (!ss.title && !ss.description && !heroImg && features.length === 0) return null
        return (
          <section id="sec-single-space" className="t1-sec" style={{ background: lightMode ? pal.surface : '#0c0c0c' }}>
            <div className="w" style={{ display: 'grid', gridTemplateColumns: heroImg ? '1fr 1fr' : '1fr', gap: 48, alignItems: 'center' }}>
              {heroImg && (
                <FadeIn>
                  <div style={{ position: 'relative', width: '100%', height: 420, borderRadius: 4, overflow: 'hidden', border: `1px solid ${fg(.06)}` }}>
                    <ZoneSlider photos={allPhotos.length > 0 ? allPhotos : [heroImg]} name={ss.title || 'Espacio'} />
                  </div>
                </FadeIn>
              )}
              <FadeUp>
                <span className="t1-label">{ss.subtitle || 'El espacio'}</span>
                {ss.title && <h2 className="t1-h2" style={{ marginBottom: 16 }}>{ss.title}</h2>}
                {ss.description && <p className="t1-p" style={{ color: fg(.7), lineHeight: 1.7, marginBottom: 24 }}>{ss.description}</p>}
                {(ss.sqm || ss.min_guests || ss.max_guests) && (
                  <div style={{ display: 'flex', gap: 32, marginBottom: 20, paddingTop: 20, borderTop: `1px solid ${fg(.08)}` }}>
                    {ss.sqm && (
                      <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 300, color: pal.text, fontFamily: FONT, lineHeight: 1 }}>{ss.sqm}<span style={{ fontSize: '.7em', color: fg(.55) }}> m²</span></div>
                        <div style={{ fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: fg(.45), marginTop: 4 }}>Superficie</div>
                      </div>
                    )}
                    {(ss.min_guests || ss.max_guests) && (
                      <div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 300, color: pal.text, fontFamily: FONT, lineHeight: 1 }}>
                          {ss.min_guests && ss.max_guests ? `${ss.min_guests}–${ss.max_guests}` : (ss.max_guests || ss.min_guests)}
                        </div>
                        <div style={{ fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: fg(.45), marginTop: 4 }}>
                          {ss.min_guests && ss.max_guests ? 'Capacidad' : ss.max_guests ? 'Capacidad máx.' : 'Capacidad mín.'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {features.filter(Boolean).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {features.filter(Boolean).map((f, i) => (
                      <span key={i} style={{ fontSize: '.72rem', padding: '5px 12px', border: `1px solid ${fg(.15)}`, borderRadius: 999, color: fg(.65), letterSpacing: '.04em' }}>{f}</span>
                    ))}
                  </div>
                )}
                {(() => {
                  const dp: any[] = Array.isArray(ss.date_prices) ? ss.date_prices.filter((e: any) => e.price_min) : []
                  if (dp.length === 0) return null
                  if (on('space_groups') && visibleSpaceGroups.length > 0) return null  // shown inside space_groups section
                  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                  const fmtPrice = (p: string) => { const n = parseFloat(p); return isNaN(n) ? p : n.toLocaleString('es-ES') + '€' }
                  const rangeLabel = (e: any) => {
                    if (!e.date_to || e.date_to === e.date_from) return fmtDate(e.date_from)
                    const days = Math.round((new Date(e.date_to + 'T12:00:00').getTime() - new Date(e.date_from + 'T12:00:00').getTime()) / 86400000)
                    if (days === 1) return `${fmtDate(e.date_from)} o ${fmtDate(e.date_to)}`
                    return `${fmtDate(e.date_from)} – ${fmtDate(e.date_to)}`
                  }
                  const priceKey = (e: any) => `${e.price_min ?? ''}|${e.price_max ?? ''}`
                  const priceLabel = (e: any) => e.price_max ? `${fmtPrice(e.price_min)} – ${fmtPrice(e.price_max)}` : fmtPrice(e.price_min)
                  // Group entries by price — same price = one pill
                  const grouped: Array<{ key: string; entries: any[]; priceStr: string }> = []
                  for (const entry of dp) {
                    const k = priceKey(entry)
                    const existing = grouped.find(g => g.key === k)
                    if (existing) existing.entries.push(entry)
                    else grouped.push({ key: k, entries: [entry], priceStr: priceLabel(entry) })
                  }
                  const usePills = grouped.length <= 5
                  return (
                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${fg(.08)}` }}>
                      <div style={{ fontSize: '.65rem', letterSpacing: '.18em', textTransform: 'uppercase', color: fg(.45), marginBottom: 12 }}>Elige tu fecha</div>
                      {usePills ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {grouped.map((group, i) => {
                            const sel = selectedDatePriceIdx === i
                            return (
                              <button key={i} type="button" onClick={() => setSelectedDatePriceIdx(sel ? null : i)}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '10px 16px', borderRadius: 8, border: `1.5px solid ${sel ? primary : fg(.15)}`, background: sel ? `${primary}12` : 'transparent', cursor: 'pointer', transition: 'all .15s' }}>
                                {group.entries.map((entry, j) => (
                                  <span key={j} style={{ fontSize: '.8rem', color: sel ? primary : fg(.7), fontWeight: sel ? 600 : 400 }}>{rangeLabel(entry)}</span>
                                ))}
                                <span style={{ fontSize: '.75rem', color: sel ? primary : fg(.5), fontFamily: FONT }}>{group.priceStr}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {grouped.map((group, i) => {
                            const sel = selectedDatePriceIdx === i
                            return (
                              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 12px', borderRadius: 6, border: `1px solid ${sel ? primary : fg(.1)}`, background: sel ? `${primary}0d` : 'transparent' }}>
                                <input type="radio" checked={sel} onChange={() => setSelectedDatePriceIdx(i)} style={{ accentColor: primary, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: '.82rem', color: fg(.75) }}>
                                  {group.entries.map((e, j) => <span key={j} style={{ display: 'block' }}>{rangeLabel(e)}</span>)}
                                </span>
                                <span style={{ fontSize: '.82rem', color: sel ? primary : fg(.5), fontFamily: FONT, fontWeight: sel ? 600 : 400 }}>{group.priceStr}</span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* ════════════════════════════════════════════
          ESPACIOS / ZONES
      ════════════════════════════════════════════ */}
      {on('zones') && (zonesShow.length > 0 ? (
        <section id="sec-zones" className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">{(sec as any).zones_header?.label || 'Espacios'}</span>
              <h2 className="t1-h2">{(sec as any).zones_header?.title || 'Cada rincón, un escenario'}</h2>
            </FadeUp>
          </div>
          <div className="t1-zones">
            {zonesShow.map((z: any, i: number) => {
              const zPhotos: string[] = z.photos?.length ? z.photos : (photos[i + 2] ? [photos[i + 2]] : [])
              const caps = formatZoneCapacities(z)
              const feats = formatZoneFeatures(z)
              const reverse = i % 2 === 1
              const hasSuppl = zonesMode === 'zones' && !!z.price
              const suppSel = !!selectedZoneSupplements[i]
              return (
                <FadeIn key={i} delay={0.05}>
                  <div className={`t1-zone${reverse ? ' t1-zone-reverse' : ''}`} style={hasSuppl && suppSel ? { outline: `2px solid ${primary}`, outlineOffset: 2, borderRadius: 4 } : undefined}>
                    <div className="t1-zone-img">
                      {zPhotos.length > 0
                        ? <ZoneSlider photos={zPhotos} name={z.name} />
                        : <div className="t1-zone-ph"><IcoBuilding width={48} height={48} style={{ opacity: .3, color: pal.text }} /></div>
                      }
                    </div>
                    <div className="t1-zone-info">
                      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: fg(.32) }}>{z.subtitle || `Espacio ${String(i + 1).padStart(2, '0')}`}</div>
                      <div className="t1-zone-name">{z.name}</div>
                      {z.description && <p className="t1-zone-desc">{z.description}</p>}
                      {caps.length > 0 && (
                        <div className="t1-zone-cap" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {caps.map((c, ci) => <span key={ci}>{c}</span>)}
                        </div>
                      )}
                      {feats.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                          {feats.map((f, fi) => (
                            <span key={fi} style={{ fontSize: '.68rem', padding: '3px 10px', border: `1px solid ${fg(.1)}`, borderRadius: 0, color: fg(.5), letterSpacing: '.06em', textTransform: 'uppercase' }}>{f}</span>
                          ))}
                        </div>
                      )}
                      {z.notes && <div style={{ fontSize: '.72rem', color: fg(.5), marginTop: 8, fontStyle: 'italic' }}>{z.notes}</div>}
                      {hasSuppl && (
                        <button type="button" onClick={() => setSelectedZoneSupplements(p => ({ ...p, [i]: !p[i] }))}
                          style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 8, border: `1.5px solid ${suppSel ? primary : fg(.2)}`, background: suppSel ? primary : 'transparent', color: suppSel ? (isDark(primary) ? '#fff' : '#111') : fg(.7), fontSize: '.75rem', fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer', transition: 'all .2s' }}>
                          {suppSel ? '✓ Añadido' : '+ Añadir'} · {formatZonePrice(z.price)}
                        </button>
                      )}
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>
      ) : _preview ? <EmptySec label="Espacios" /> : null)}

      {/* ════════════════════════════════════════════
          GRUPOS DE ESPACIOS
      ════════════════════════════════════════════ */}
      {on('space_groups') && visibleSpaceGroups.length > 0 ? (
        <div id="sec-space-groups">
          {/* Validation warning when trying to book without required selections */}
          {validationError && (
            <div style={{
              maxWidth: 700, margin: '0 auto 24px', padding: '14px 20px', borderRadius: 12,
              background: 'rgba(239,68,68,.08)', border: '1.5px solid rgba(239,68,68,.25)',
              display: 'flex', alignItems: 'center', gap: 10,
              animation: 'fadeIn .3s ease',
            }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <span style={{ fontSize: '.82rem', color: '#b91c1c', fontWeight: 600 }}>{validationError}</span>
            </div>
          )}
          <SpaceGroupSelector
            groups={visibleSpaceGroups}
            primary={primary}
            onPrimary={onPri}
            dark={!lightMode}
            font={FONT}
            guestCount={guests}
            onSelectionChange={setSelectedSpaces}
            pricingBlock={(() => {
              const blocks: React.ReactNode[] = []

              // DateSelector (date_slots)
              if (on('date_slots') && dateSlots && dateSlots.length > 1) {
                blocks.push(
                  <DateSelector key="ds" slots={dateSlots} primary={primary} onPrimary={onPri} dark={!lightMode} font={FONT} proposalId={data.id} onSelect={setSelectedDateSlotIdx} guestCount={guests} />
                )
              }

              // date_prices — always shown if data exists and venue_rental not active
              if (!(on('venue_rental') && (sec.venue_rental?.rows?.length ?? 0) > 0)) {
                const dp: any[] = Array.isArray((sec as any).single_space?.date_prices)
                  ? (sec as any).single_space.date_prices.filter((e: any) => e.price_min)
                  : []
                if (dp.length > 0) {
                  const fmtDateP = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
                  const fmtPriceP = (p: string) => { const n = parseFloat(p); return isNaN(n) ? p : n.toLocaleString('es-ES') + '€' }
                  const rangeLabelP = (e: any) => {
                    if (!e.date_to || e.date_to === e.date_from) return fmtDateP(e.date_from)
                    const days = Math.round((new Date(e.date_to + 'T12:00:00').getTime() - new Date(e.date_from + 'T12:00:00').getTime()) / 86400000)
                    if (days === 1) return `${fmtDateP(e.date_from)} o ${fmtDateP(e.date_to)}`
                    return `${fmtDateP(e.date_from)} – ${fmtDateP(e.date_to)}`
                  }
                  const priceKeyP = (e: any) => `${e.price_min ?? ''}|${e.price_max ?? ''}`
                  const priceLabelP = (e: any) => e.price_max ? `${fmtPriceP(e.price_min)} – ${fmtPriceP(e.price_max)}` : fmtPriceP(e.price_min)
                  const grouped: Array<{ key: string; entries: any[]; priceStr: string }> = []
                  for (const entry of dp) {
                    const k = priceKeyP(entry)
                    const existing = grouped.find(g => g.key === k)
                    if (existing) existing.entries.push(entry)
                    else grouped.push({ key: k, entries: [entry], priceStr: priceLabelP(entry) })
                  }
                  blocks.push(
                    <div key="dp" style={{ paddingBottom: 8 }}>
                      <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: lightMode ? '#9a8f82' : 'rgba(255,255,255,.4)', marginBottom: 14 }}>Elegid vuestra fecha</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {grouped.map((group, i) => {
                          const sel = selectedDatePriceIdx === i
                          return (
                            <button key={i} type="button" onClick={() => setSelectedDatePriceIdx(sel ? null : i)}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, padding: '12px 18px', borderRadius: 10, border: `1.5px solid ${sel ? primary : fg(.12)}`, background: sel ? `${primary}12` : (lightMode ? '#fff' : 'rgba(255,255,255,.04)'), cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}>
                              {group.entries.map((entry, j) => (
                                <span key={j} style={{ fontSize: '.82rem', color: sel ? primary : fg(.65) }}>{rangeLabelP(entry)}</span>
                              ))}
                              <span style={{ fontSize: '.88rem', fontWeight: 700, color: primary, marginTop: 4 }}>{group.priceStr}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
              }

              // VenueRentalGrid
              if (on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0) {
                blocks.push(
                  <div key="vr">
                    <div style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: lightMode ? '#9a8f82' : 'rgba(255,255,255,.4)', marginBottom: 14 }}>
                      {sec.venue_rental.title || 'Elegid vuestra fecha'}
                    </div>
                    <VenueRentalGrid data={sec.venue_rental} primary={primary} dark={!lightMode} />
                  </div>
                )
              }

              return blocks.length > 0 ? <>{blocks}</> : undefined
            })()}
          />
        </div>
      ) : on('space_groups') && _preview ? <EmptySec label="Los espacios" /> : null}

      {/* ════════════════════════════════════════════
          PAQUETES
      ════════════════════════════════════════════ */}
      {on('pricing') && on('packages') && (() => {
        const pricingStyle = getActiveStyle(sec, 'pricing')
        const hasRentalRows = (sec.venue_rental?.rows?.length ?? 0) > 0 && (sec.venue_rental?.day_tiers?.length ?? 0) > 0
        const hasContent = pkgs.length > 0 || (pricingStyle === 'rental_grid' && hasRentalRows)
        if (!hasContent) return _preview ? <EmptySec label="Paquetes" /> : null
        return (
          <section className="t1-sec" style={{ background: lightMode ? pal.bg : '#050505' }}>
            <div className="w">
              <FadeUp>
                <span className="t1-label">{(sec as any).pricing_eyebrow || 'Paquetes'}</span>
                <h2 className="t1-h2">Elige tu propuesta</h2>
              </FadeUp>
              <FadeUp delay={.1}>
                {pricingStyle === 'table' ? (
                  <PricingTable packages={pkgs} primary={primary} dark={!lightMode} font={FONT} />
                ) : pricingStyle === 'rental_grid' && hasRentalRows ? (
                  <VenueRentalGrid data={sec.venue_rental} primary={primary} dark={!lightMode} />
                ) : (
                  <PricingCards packages={pkgs} primary={primary} dark={!lightMode} font={FONT} />
                )}
              </FadeUp>
              {(hasCatering || contactOn) && (
                <FadeUp delay={.2} style={{ marginTop: 48, textAlign: 'center' }}>
                  <button style={{ background: primary, color: onPri, border: 'none', padding: '15px 44px', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}
                    onClick={() => hasCatering ? document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' }) : scrollToContact()}>
                    {hasCatering ? 'Ver menús' : 'Solicitar información'} →
                  </button>
                </FadeUp>
              )}
            </div>
          </section>
        )
      })()}

      {/* ════════════════════════════════════════════
          TARIFAS DE ALQUILER (grid temporada × día)
      ════════════════════════════════════════════ */}
      {on('venue_rental') && !(on('space_groups') && visibleSpaceGroups.length > 0) && (sec.venue_rental?.rows && sec.venue_rental.rows.length > 0 ? (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">{sec.venue_rental.title || 'Tarifas de alquiler'}</span>
              <h2 className="t1-h2">Elegid vuestra fecha</h2>
            </FadeUp>
            <FadeUp delay={.1}>
              <VenueRentalGrid data={sec.venue_rental} primary={primary} dark={!lightMode} />
            </FadeUp>
          </div>
        </section>
      ) : _preview ? <EmptySec label="Tarifas de alquiler" /> : null)}

      {/* ════════════════════════════════════════════
          TEMPORADAS
      ════════════════════════════════════════════ */}
      {on('season_prices') && (seasonsShow.length > 0 ? (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">Tarifas por temporada</span>
              <h2 className="t1-h2">Planifica vuestra fecha</h2>
            </FadeUp>
            <div className="t1-seasons">
              {seasonsShow.map((s: any, i: number) => (
                <FadeUp key={i} delay={i * .07}>
                  <div className={`t1-season${s.season === 'alta' || i === 0 ? ' alta' : ''}`}>
                    <div className="t1-season-lbl">{s.label || s.season}</div>
                    <div>
                      <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: fg(.4), marginBottom: 4 }}>{s.date_range}</div>
                      {s.notes && <div className="t1-season-dates">{s.notes}</div>}
                    </div>
                    <div className="t1-season-price">{s.price_modifier}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      ) : _preview ? <EmptySec label="Temporadas" /> : null)}

      {/* ════════════════════════════════════════════
          QUÉ INCLUYE
      ════════════════════════════════════════════ */}
      {on('inclusions') && (inclusionsShow.length > 0 ? (() => {
        const inclusionsStyle = getActiveStyle(sec, 'inclusions')
        const InclusionsComp = inclusionsStyle === 'list' ? InclusionsList : inclusionsStyle === 'cards' ? InclusionsCards : InclusionsGrid
        return (
          <section className="t1-sec" style={{ background: lightMode ? pal.surfaceAlt : '#0e0e0e' }}>
            <div className="w">
              <FadeUp>
                <span className="t1-label">{(sec as any).inclusions_eyebrow || (sec as any).inclusions_title || 'Qué incluye'}</span>
                <h2 className="t1-h2" style={{ whiteSpace: 'pre-line' }}>{(sec as any).inclusions_subtitle || 'Todo lo que necesitáis,\nsin sorpresas'}</h2>
              </FadeUp>
              <FadeUp delay={.05}>
                <InclusionsComp items={inclusionsShow} primary={primary} dark={!lightMode} columns={(sec as any).inclusions_columns ?? 2} />
              </FadeUp>
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="Qué incluye" /> : null)}

      {/* ════════════════════════════════════════════
          CONFIGURA VUESTRA BODA (WeddingProposal)
      ════════════════════════════════════════════ */}
      {on('menu') && (hasCatering && (menusStructured?.length || menuExtras?.length || appetizersBase?.length || menuShow.length > 0) ? (
        <>
        <WeddingProposal
          data={data}
          menus={menusStructured}
          extras={menuExtras}
          appetizers={appetizersBase}
          legacyMenus={menuShow}
          primary={primary}
          onPrimary={onPri}
          dark={!lightMode}
          onMenusChange={setSelectedMenus}
          onTotalChange={setMenuTotal}
          onValidationChange={setMenuValidationErrors}
          onCartChange={setMenuCart}
          validationWarning={validationError && menuValidationErrors.length > 0 ? validationError : null}
        />
        </>
      ) : _preview ? <EmptySec label="Menú" /> : null)}

      {/* ════════════════════════════════════════════
          COLABORADORES (siempre tras menú)
      ════════════════════════════════════════════ */}
      {on('collaborators') && (collabsShow.length > 0 ? (() => {
        const cm = (sec as any).collaborators_meta ?? {}
        return (
          <section className="t1-sec">
            <div className="w">
              <FadeUp>
                <span className="t1-label">{cm.eyebrow || 'Proveedores de confianza'}</span>
                <h2 className="t1-h2">{cm.title || 'Nuestros colaboradores'}</h2>
                <p style={{ fontSize: '.9rem', color: fg(.5), lineHeight: 1.8, maxWidth: 560, marginBottom: 48, marginTop: -32 }}>
                  {cm.subtitle || 'Trabajamos sin exclusividad, pero os recomendamos a quienes conocemos y en quienes confiamos.'}
                </p>
              </FadeUp>
            </div>
            <div className="t1-collabs-grid" style={{ maxWidth: 960, margin: '0 auto' }}>
              {collabsShow.map((c: any, i: number) => {
                const catKey = c.category || `collab-${i}`
                const own = ownProviders[catKey]
                return (
                <FadeUp key={i} delay={(i % 4) * .05}>
                  <div className={`t1-collab${c.exclusive ? ' t1-collab-exclusive' : ''}`}>
                    {c.exclusive && <div className="t1-collab-badge">★ Exclusivo</div>}
                    <div className="t1-collab-cat">{c.category}</div>
                    <div className="t1-collab-name">{c.name}</div>
                    {c.description && <div className="t1-collab-desc">{c.description}</div>}
                    {c.price_info && <div className="t1-collab-price">{c.price_info}</div>}
                    {(c.website || c.instagram || c.email || c.phone) && (
                      <div className="t1-collab-links">
                        {c.phone && <a href={`tel:${c.phone}`}>📞 {c.phone}</a>}
                        {c.website && <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer">Web ↗</a>}
                        {c.instagram && <a href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer">@{c.instagram.replace('@', '')}</a>}
                        {c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}
                      </div>
                    )}
                    {/* Exclusivity: own provider option with price + toggle */}
                    {c.exclusive && c.exclusivity_price && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${fg(.06)}`, paddingTop: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '.72rem', color: fg(.5), lineHeight: 1.5 }}>
                              Prefiero traer mi propio proveedor
                            </div>
                          </div>
                          <span style={{ fontSize: '.85rem', fontWeight: 600, color: primary, whiteSpace: 'nowrap' }}>
                            {Number(c.exclusivity_price).toLocaleString('es-ES')} €
                          </span>
                          <button
                            type="button"
                            onClick={() => setOwnProviders(prev => ({
                              ...prev,
                              [catKey]: { useOwn: !prev[catKey]?.useOwn, providerName: prev[catKey]?.providerName ?? '' }
                            }))}
                            style={{
                              flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                              border: `1.5px solid ${own?.useOwn ? primary : fg(.25)}`,
                              background: own?.useOwn ? primary : 'transparent',
                              color: own?.useOwn ? onPri : fg(.5),
                              fontSize: own?.useOwn ? '.7rem' : '1rem', fontWeight: 600,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all .15s',
                            }}
                          >
                            {own?.useOwn ? '✓' : '+'}
                          </button>
                        </div>
                        {own?.useOwn && (
                          <input
                            className="t1-collab-own-input"
                            placeholder="Nombre del proveedor (opcional)"
                            value={own.providerName}
                            onChange={e => setOwnProviders(prev => ({
                              ...prev,
                              [catKey]: { ...prev[catKey], providerName: e.target.value }
                            }))}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </FadeUp>
                )
              })}
            </div>
            {/* Generic non-exclusivity price — row like extra services */}
            {cm.generic_exclusivity_price && (() => {
              const genKey = '__generic_exclusivity'
              const genOwn = ownProviders[genKey]
              return (
              <div className="w" style={{ maxWidth: 960, margin: '32px auto 0' }}>
                <FadeUp delay={.1}>
                  <div style={{ borderTop: `1px solid ${fg(.08)}`, paddingTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 0' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.85rem', fontWeight: 600, color: fg(.8) }}>Proveedor externo</div>
                        <div style={{ fontSize: '.75rem', color: fg(.45), lineHeight: 1.5, marginTop: 2 }}>Suplemento si traéis vuestros propios proveedores</div>
                      </div>
                      <span style={{ fontSize: '.95rem', fontWeight: 600, color: primary, whiteSpace: 'nowrap' }}>
                        {Number(cm.generic_exclusivity_price).toLocaleString('es-ES')} €
                      </span>
                      <button
                        type="button"
                        onClick={() => setOwnProviders(prev => ({
                          ...prev,
                          [genKey]: { useOwn: !prev[genKey]?.useOwn, providerName: prev[genKey]?.providerName ?? '' }
                        }))}
                        style={{
                          flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
                          border: `1.5px solid ${genOwn?.useOwn ? primary : fg(.25)}`,
                          background: genOwn?.useOwn ? primary : 'transparent',
                          color: genOwn?.useOwn ? onPri : fg(.5),
                          fontSize: genOwn?.useOwn ? '.75rem' : '1.1rem', fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all .15s', marginLeft: 4,
                        }}
                      >
                        {genOwn?.useOwn ? '✓' : '+'}
                      </button>
                    </div>
                    {genOwn?.useOwn && (
                      <input
                        className="t1-collab-own-input"
                        placeholder="Nombre del proveedor (opcional)"
                        value={genOwn.providerName}
                        onChange={e => setOwnProviders(prev => ({
                          ...prev,
                          [genKey]: { ...prev[genKey], providerName: e.target.value }
                        }))}
                        style={{ marginBottom: 8 }}
                      />
                    )}
                  </div>
                </FadeUp>
              </div>
              )
            })()}
            {/* Submit own-provider selections */}
            {Object.values(ownProviders).some(v => v.useOwn) && (
              <div className="w" style={{ maxWidth: 960, margin: '24px auto 0', textAlign: 'center' }}>
                <FadeUp delay={.15}>
                  {providerSubmitted ? (
                    <div style={{ fontSize: '.85rem', color: primary, fontWeight: 600, padding: '12px 0' }}>
                      ✓ Selección enviada al venue
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={submitOwnProviders}
                      disabled={providerSubmitting}
                      style={{
                        padding: '12px 32px', borderRadius: 8, border: 'none',
                        background: primary, color: onPri, fontSize: '.85rem',
                        fontWeight: 600, cursor: providerSubmitting ? 'wait' : 'pointer',
                        opacity: providerSubmitting ? .6 : 1, transition: 'opacity .15s',
                      }}
                    >
                      {providerSubmitting ? 'Enviando…' : 'Confirmar proveedores seleccionados'}
                    </button>
                  )}
                </FadeUp>
              </div>
            )}
          </section>
        )
      })() : _preview ? <EmptySec label="Colaboradores" /> : null)}

      {/* ════════════════════════════════════════════
          TESTIMONIALES
      ════════════════════════════════════════════ */}
      {on('testimonials') && (testsShow.length > 0 ? (() => {
        const testimonialsStyle = getActiveStyle(sec, 'testimonials')
        const TestimonialsComp = testimonialsStyle === 'featured' ? TestimonialsFeatured : testimonialsStyle === 'quotes' ? TestimonialsQuotes : testimonialsStyle === 'compact' ? TestimonialsCompact : TestimonialsCards
        return (
          <section className="t1-sec" style={{ background: lightMode ? pal.surface : '#050505' }}>
            <div className="w">
              <FadeUp>
                <span className="t1-label">{(sec as any).testimonials_eyebrow || 'Testimonios'}</span>
                <h2 className="t1-h2">Experiencias reales</h2>
              </FadeUp>
              <FadeUp delay={.05}>
                <TestimonialsComp items={testsShow} primary={primary} dark={!lightMode} font={FONT} />
              </FadeUp>
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="Testimoniales" /> : null)}

      {/* ════════════════════════════════════════════
          ALOJAMIENTO
      ════════════════════════════════════════════ */}
      {on('accommodation') && accom && (() => {
        const accomStyle = getActiveStyle(sec, 'accommodation')
        const isInteractive = accomStyle === 'interactive' && Array.isArray(accom.options) && accom.options.length > 0

        /* ── INTERACTIVE MODE — bookable room cards ── */
        if (isInteractive) {
          return (
            <section className="t1-sec" style={{ background: lightMode ? pal.bg : '#0a0a0a' }}>
              <div className="w">
                <FadeUp>
                  <span className="t1-label">{(sec as any).accommodation_eyebrow || 'Alojamiento'}</span>
                  <h2 className="t1-h2">{(sec as any).accommodation_title || 'Reservad vuestras habitaciones'}</h2>
                  {accom.description && <p style={{ fontSize: '.9rem', color: fg(.48), lineHeight: 1.8, maxWidth: 600, marginBottom: 40, marginTop: -32 }}>{accom.description}</p>}
                </FadeUp>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1px', background: fg(.06) }}>
                  {accom.options!.map((opt: any, oi: number) => {
                    const qty = selectedAccomRooms[oi] ?? (opt.included ? 1 : 0)
                    const maxQ = opt.max_qty ?? 1
                    const isIncluded = !!opt.included
                    const firstPrice = opt.prices?.[0]?.price || opt.price_info || null

                    return (
                      <FadeUp key={oi} delay={oi * .05}>
                        <div style={{
                          background: lightMode ? pal.surface : '#111',
                          padding: '32px 28px',
                          display: 'flex', flexDirection: 'column', gap: 12,
                          minHeight: 200,
                          borderLeft: qty > 0 ? `2px solid ${primary}` : `2px solid transparent`,
                          transition: 'border-color .2s',
                        }}>
                          {/* Room name */}
                          <div style={{ fontFamily: FONT, fontSize: '1.15rem', fontWeight: 300, color: pal.text, lineHeight: 1.2 }}>
                            {opt.label}
                          </div>

                          {/* Description */}
                          {opt.description && (
                            <div style={{ fontSize: '.8rem', color: fg(.45), lineHeight: 1.6 }}>{opt.description}</div>
                          )}

                          {/* Prices */}
                          {isIncluded ? (
                            <div style={{ fontSize: '.76rem', color: primary, fontWeight: 600, letterSpacing: '.04em', marginTop: 'auto', paddingTop: 8 }}>
                              ✓ Incluido
                            </div>
                          ) : (
                            <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                              {Array.isArray(opt.prices) && opt.prices.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {opt.prices.map((p: any, pi: number) => (
                                    <div key={pi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}>
                                      <span style={{ color: fg(.4) }}>{p.season}</span>
                                      <span style={{ fontFamily: FONT, fontWeight: 400, color: pal.text }}>{p.price}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : firstPrice ? (
                                <div style={{ fontFamily: FONT, fontSize: '1.1rem', fontWeight: 300, color: primary }}>{firstPrice}</div>
                              ) : null}
                            </div>
                          )}

                          {/* Quantity selector — not shown for included items */}
                          {!isIncluded && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 0,
                              marginTop: 8,
                              border: `1px solid ${fg(.1)}`,
                              alignSelf: 'flex-start',
                            }}>
                              <button
                                type="button"
                                onClick={() => setSelectedAccomRooms(prev => ({ ...prev, [oi]: Math.max(0, (prev[oi] ?? 0) - 1) }))}
                                style={{
                                  width: 36, height: 36, border: 'none', borderRight: `1px solid ${fg(.1)}`,
                                  background: 'transparent', color: qty > 0 ? fg(.7) : fg(.2),
                                  fontSize: '1.1rem', cursor: qty > 0 ? 'pointer' : 'default',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >−</button>
                              <div style={{
                                width: 44, height: 36,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '.88rem', fontWeight: 600, color: qty > 0 ? primary : fg(.3),
                                fontFamily: FONT,
                              }}>{qty}</div>
                              <button
                                type="button"
                                onClick={() => setSelectedAccomRooms(prev => ({ ...prev, [oi]: Math.min(maxQ, (prev[oi] ?? 0) + 1) }))}
                                style={{
                                  width: 36, height: 36, border: 'none', borderLeft: `1px solid ${fg(.1)}`,
                                  background: 'transparent', color: qty < maxQ ? fg(.7) : fg(.2),
                                  fontSize: '1.1rem', cursor: qty < maxQ ? 'pointer' : 'default',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >+</button>
                            </div>
                          )}
                        </div>
                      </FadeUp>
                    )
                  })}
                </div>

                {/* Nearby info */}
                {accom.nearby && (
                  <FadeUp delay={.15}>
                    <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${fg(.06)}` }}>
                      <div style={{ fontSize: '.58rem', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: fg(.3), marginBottom: 10 }}>Alojamientos cercanos</div>
                      <p style={{ fontSize: '.84rem', color: fg(.4), lineHeight: 1.75 }}>{accom.nearby}</p>
                    </div>
                  </FadeUp>
                )}
              </div>
            </section>
          )
        }

        /* ── INFORMATIONAL MODE — descriptive, no booking ── */
        return (
          <section className="t1-sec" style={{ background: lightMode ? pal.surfaceAlt : '#0e0e0e', borderTop: 'none' }}>
            <div className="w">
              <FadeUp>
                <div style={{ maxWidth: 680 }}>
                  <span className="t1-label" style={{ color: fg(.3) }}>{(sec as any).accommodation_eyebrow || 'Alojamiento'}</span>
                  <h2 className="t1-h2" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', marginBottom: 24 }}>
                    {(sec as any).accommodation_title || 'Quedaos a dormir'}
                  </h2>
                  <p style={{ fontSize: '.92rem', color: fg(.5), lineHeight: 1.9, marginBottom: 32 }}>{accom.description}</p>
                </div>
              </FadeUp>

              {/* Room list — horizontal chips */}
              {(() => {
                const roomsList = (Array.isArray(accom.rooms_list) ? accom.rooms_list : accom.rooms ? accom.rooms.split('·') : []).filter(Boolean)
                if (!roomsList.length) return null
                return (
                  <FadeUp delay={.05}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 36 }}>
                      {roomsList.map((r: string, i: number) => (
                        <span key={i} style={{
                          fontSize: '.76rem', padding: '8px 16px',
                          background: lightMode ? pal.surface : fg(.04),
                          color: fg(.6), letterSpacing: '.02em',
                        }}>{typeof r === 'string' ? r.trim() : r}</span>
                      ))}
                    </div>
                  </FadeUp>
                )
              })()}

              {/* Pricing info — if available, show as simple text */}
              {(Array.isArray(accom.options) && accom.options.length > 0) ? (
                <FadeUp delay={.1}>
                  <div style={{ borderTop: `1px solid ${fg(.06)}`, paddingTop: 28 }}>
                    <div style={{ fontSize: '.58rem', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: fg(.3), marginBottom: 20 }}>Tarifas orientativas</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {accom.options.map((opt: any, oi: number) => (
                        <div key={oi} style={{ display: 'flex', alignItems: 'baseline', gap: 16, paddingBottom: 16, borderBottom: oi < accom.options!.length - 1 ? `1px solid ${fg(.04)}` : 'none' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '.88rem', fontWeight: 500, color: fg(.75) }}>{opt.label}</div>
                            {opt.description && <div style={{ fontSize: '.76rem', color: fg(.4), marginTop: 2 }}>{opt.description}</div>}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {opt.included ? (
                              <span style={{ fontSize: '.78rem', color: primary, fontWeight: 500 }}>Incluido</span>
                            ) : opt.price_info ? (
                              <span style={{ fontSize: '.86rem', color: fg(.6), fontFamily: FONT }}>{opt.price_info}</span>
                            ) : Array.isArray(opt.prices) && opt.prices.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                                {opt.prices.map((p: any, pi: number) => (
                                  <span key={pi} style={{ fontSize: '.8rem', color: fg(.5) }}>{p.season}: <span style={{ fontFamily: FONT, color: fg(.7) }}>{p.price}</span></span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </FadeUp>
              ) : accom.price_info ? (
                <FadeUp delay={.1}>
                  <div style={{ borderTop: `1px solid ${fg(.06)}`, paddingTop: 24 }}>
                    <p style={{ fontSize: '.86rem', color: fg(.48), lineHeight: 1.85 }}>{accom.price_info}</p>
                  </div>
                </FadeUp>
              ) : null}

              {accom.nearby && (
                <FadeUp delay={.15}>
                  <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${fg(.06)}` }}>
                    <div style={{ fontSize: '.58rem', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', color: fg(.3), marginBottom: 10 }}>Alojamientos cercanos</div>
                    <p style={{ fontSize: '.84rem', color: fg(.4), lineHeight: 1.75 }}>{accom.nearby}</p>
                  </div>
                </FadeUp>
              )}
            </div>
          </section>
        )
      })()}

      {/* ════════════════════════════════════════════
          SERVICIOS ADICIONALES
      ════════════════════════════════════════════ */}
      {on('extra_services') && (extrasShow.length > 0 ? (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">{(sec as any).extra_services_eyebrow || 'Servicios adicionales'}</span>
              <h2 className="t1-h2">{(sec as any).extra_services_eyebrow || 'Servicios adicionales'}</h2>
            </FadeUp>
            {extrasShow.map((svc: any, i: number) => {
              const isSel = !!selectedExtraSvcs[svc.name]
              return (
                <FadeUp key={i} delay={i * .05}>
                  <div className="t1-extra-row" style={{ cursor: 'pointer' }} onClick={() => setSelectedExtraSvcs(p => ({ ...p, [svc.name]: !p[svc.name] }))}>
                    <div style={{ flex: 1 }}>
                      <div className="t1-extra-name">{svc.name}</div>
                      {svc.description && <div className="t1-extra-desc">{svc.description}</div>}
                    </div>
                    {svc.price && <span className="t1-extra-price">{svc.price}</span>}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setSelectedExtraSvcs(p => ({ ...p, [svc.name]: !p[svc.name] })) }}
                      style={{
                        flexShrink: 0, width: 30, height: 30, borderRadius: '50%',
                        border: `1.5px solid ${isSel ? primary : `${fg(.25)}`}`,
                        background: isSel ? primary : 'transparent',
                        color: isSel ? onPri : fg(.5),
                        fontSize: isSel ? '.75rem' : '1.1rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all .15s', marginLeft: 12,
                      }}
                    >
                      {isSel ? '✓' : '+'}
                    </button>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </section>
      ) : _preview ? <EmptySec label="Servicios adicionales" /> : null)}

      {/* ════════════════════════════════════════════
          FAQ
      ════════════════════════════════════════════ */}
      {on('faq') && (faqShow.length > 0 ? (() => {
        const faqStyle = getActiveStyle(sec, 'faq')
        const FaqComp = faqStyle === 'cards' ? FaqCards : faqStyle === 'numbered' ? FaqNumbered : FaqAccordion
        return (
          <section className="t1-sec" style={{ background: lightMode ? pal.bg : '#050505' }}>
            <div className="w-sm">
              <FadeUp>
                <span className="t1-label">{(sec as any).faq_eyebrow || 'Preguntas frecuentes'}</span>
                <h2 className="t1-h2">{(sec as any).faq_eyebrow || 'Preguntas frecuentes'}</h2>
              </FadeUp>
              <FadeUp delay={.05}>
                <FaqComp items={faqShow} primary={primary} dark={!lightMode} />
              </FadeUp>
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="FAQ" /> : null)}

      {/* ════════════════════════════════════════════
          AGENDAR VISITA / HABLEMOS — formulario unificado
      ════════════════════════════════════════════ */}
      {on('schedule_visit') && (() => {
        const sv = (sec as any).schedule_visit ?? {}
        const variant = getActiveStyle(sec, 'schedule_visit')
        const svTitle = sv.title || 'Agendar visita'
        const svSub = sv.subtitle || (variant === 'cta'
          ? 'Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue.'
          : 'Selecciona qué prefieres y rellena tus datos. Si quieres venir a visitarnos, podrás elegir directamente fecha y hora disponibles.')

        if (variant === 'cta') {
          const svUrl = sv.url
          const svCta = sv.cta_label || 'Reservar visita gratuita →'
          const svTextColor = sv.cta_text_color || undefined
          const ctaButtons: string[] = Array.isArray(sv.cta_buttons) && sv.cta_buttons.length > 0 ? sv.cta_buttons : ['visit']
          return (
            <section id="sec-schedule" className="t1-sv">
              <FadeUp>
                <div className="t1-sv-inner">
                  <div className="t1-sv-icon">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <h2 className="t1-sv-title">{svTitle}</h2>
                  <p className="t1-sv-sub">{svSub}</p>
                  {visitDone || budgetRequestDone ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: `${primary}22`, border: `1px solid ${primary}55`, borderRadius: 10, padding: '14px 24px', fontSize: '.88rem', color: primary, fontWeight: 600 }}>
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {visitDone ? '¡Solicitud enviada! Os confirmaremos la visita pronto.' : '¡Solicitud de presupuesto enviada!'}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                      {ctaButtons.includes('visit') && (
                        svUrl ? (
                          <a className="t1-sv-btn" style={svTextColor ? { color: svTextColor } : undefined} href={svUrl} target="_blank" rel="noopener">{svCta}</a>
                        ) : (
                          <button className="t1-sv-btn" style={svTextColor ? { color: svTextColor } : undefined} onClick={() => {
                            // Same validation as sticky footer
                            if (hasCatering && menuValidationErrors.length > 0) {
                              setValidationError(menuValidationErrors[0])
                              setTimeout(() => {
                                const warn = document.getElementById('wp-validation-warning')
                                if (warn) warn.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                else document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }, 50)
                              setTimeout(() => setValidationError(null), 6000)
                              return
                            }
                            const missingGroups = (visibleSpaceGroups ?? []).filter(g => {
                              const sm = g.selection_mode
                              const isOpt = g.optional || sm === 'optional' || sm === 'optional_one' || sm === 'optional_any' || sm === 'none' || g.requires_selection === false
                              if (isOpt) return false
                              if (!g.name || !g.name.trim()) return false
                              if (!Array.isArray((g as any).spaces) || (g as any).spaces.length === 0) return false
                              return !selectedSpaces.some(s => s.group_name === g.name)
                            })
                            if (missingGroups.length > 0) {
                              const firstIdx = visibleSpaceGroups.findIndex(g => g.name === missingGroups[0].name)
                              const el = document.getElementById(`space-group-${firstIdx}`)
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                              setValidationError(`Selecciona una opción en: ${missingGroups.map(g => g.name).join(', ')}`)
                              setTimeout(() => setValidationError(null), 6000)
                              return
                            }
                            setValidationError(null)
                            setVisitModalOpen(true)
                          }}>{svCta}</button>
                        )
                      )}
                      {ctaButtons.includes('budget') && (
                        <button className="t1-sv-btn" style={{ background: 'transparent', border: `2px solid ${primary}`, color: primary }} onClick={() => setBudgetRequestOpen(true)}>
                          {sv.budget_cta_label || 'Solicitar presupuesto →'}
                        </button>
                      )}
                    </div>
                  )}
                  {sv.note && <div className="t1-sv-note">{sv.note}</div>}
                  <p style={{ marginTop: 20, fontSize: '.76rem', color: `${fg(.4)}`, lineHeight: 1.7, maxWidth: 400 }}>
                    Al reservar la visita, vuestras selecciones se incluyen en la solicitud para que preparemos un presupuesto personalizado.
                  </p>
                </div>
              </FadeUp>
            </section>
          )
        }

        const svKinds = Array.isArray(sv.kinds) && sv.kinds.length > 0 ? sv.kinds : undefined
        return (
          <section id="sec-schedule" className="t1-sec" style={{ background: lightMode ? pal.surfaceAlt : '#0a0a0a' }}>
            <div className="w">
              <FadeUp>
                <span className="t1-label" style={{ display: 'block', textAlign: 'center' }}>{svTitle}</span>
                <p style={{ textAlign: 'center', fontSize: '.95rem', color: fg(.55), maxWidth: 540, margin: '0 auto 40px', lineHeight: 1.7 }}>
                  {svSub}
                </p>
              </FadeUp>
              <FadeUp delay={.1}>
                <InquiryForm slug={data.slug} proposalId={data.id} coupleName={couple_name} kinds={svKinds} primary={primary} onPrimary={onPri} dark={!lightMode} />
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* Floating validation toast — shows above sticky footer when click blocked */}
      {validationError && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9500, maxWidth: 480, width: 'calc(100% - 32px)',
          padding: '14px 20px', borderRadius: 12,
          background: '#b91c1c', color: '#fff',
          boxShadow: '0 10px 40px rgba(0,0,0,.35)',
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'fadeIn .25s ease',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ fontSize: '.85rem', fontWeight: 600, lineHeight: 1.4 }}>{validationError}</span>
        </div>
      )}

      {visitModalOpen && (
        <VisitBookingModal
          proposalId={data.id}
          coupleName={couple_name}
          primaryColor={primary}
          selectedSpaces={selectedSpaces}
          selectedMenus={selectedMenus}
          menuCart={menuCartRef.current}
          guestCount={guests}
          weddingDate={wedding_date ?? undefined}
          selectedExtraSvcs={[
            ...Object.entries(selectedExtraSvcs).filter(([,v]) => v).map(([k]) => k),
            ...zonesShow.filter((z: any, i: number) => zonesMode === 'zones' && z.price && selectedZoneSupplements[i]).map((z: any) => `${z.name} (${formatZonePrice(z.price)})`),
            ...Object.entries(selectedAccomRooms).filter(([,qty]) => qty > 0).map(([idx, qty]) => { const opt = accom?.options?.[Number(idx)]; return opt ? `${opt.label} ×${qty}` : '' }).filter(Boolean),
          ]}
          spaceGroups={visibleSpaceGroups.length > 0 ? visibleSpaceGroups : undefined}
          dateSlots={dateSlots ?? []}
          preSelectedDateSlot={selectedDateSlotIdx}
          onClose={() => setVisitModalOpen(false)}
          onSuccess={() => { setVisitModalOpen(false); setVisitDone(true) }}
        />
      )}

      {budgetRequestOpen && (() => {
        const sbarC = (sec as any).sbar_text_color || onPri
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}
            onClick={() => setBudgetRequestOpen(false)}>
            <div style={{ background: lightMode ? '#fff' : '#1a1a1a', borderRadius: 16, width: '100%', maxWidth: 440, padding: '28px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: fg(.9), marginBottom: 4 }}>Solicitar presupuesto</h3>
              <p style={{ fontSize: '.82rem', color: fg(.45), marginBottom: 18, lineHeight: 1.5 }}>
                Revisad vuestras selecciones y enviad la solicitud.
              </p>
              <BudgetRequestForm
                proposalId={data.id}
                selectedSpaces={selectedSpaces}
                selectedMenus={selectedMenus}
                selectedExtraSvcs={[
                  ...Object.entries(selectedExtraSvcs).filter(([,v]) => v).map(([k]) => k),
                  ...zonesShow.filter((z: any, i: number) => zonesMode === 'zones' && z.price && selectedZoneSupplements[i]).map((z: any) => `${z.name} (${formatZonePrice(z.price)})`),
                ]}
                menuCart={menuCartRef.current}
                guestCount={guests}
                weddingDate={wedding_date ?? undefined}
                primary={primary}
                btnTextColor={sbarC}
                dark={!lightMode}
                fg={fg}
                onSuccess={() => { setBudgetRequestOpen(false); setBudgetRequestDone(true) }}
                onClose={() => setBudgetRequestOpen(false)}
              />
            </div>
          </div>
        )
      })()}

      {/* ════════════════════════════════════════════
          MAPA
      ════════════════════════════════════════════ */}
      {on('map') && (() => {
        const mapMeta: any = (sec as any).map_meta ?? {}
        const address = sec.map_address || (data.venueContent.map_info as any)?.address
        const embedRaw = sec.map_embed_url || (data.venueContent.map_info as any)?.embed_url
        const venueName = venue?.name ?? ''
        const venueLocation = address || (venue?.city ? `${venueName}, ${venue.city}${venue.region ? `, ${venue.region}` : ''}` : venueName)
        if (!venueLocation && !embedRaw) return null
        return (
          <section className="t1-sec" style={{ position: 'relative', zIndex: 0 }}>
            <div className="w">
              <FadeUp>
                <span className="t1-label">{mapMeta.eyebrow || 'Ubicación'}</span>
                <h2 className="t1-h2">{mapMeta.title || 'Cómo llegar'}</h2>
                {(mapMeta.subtitle || address) && (
                  <p style={{ fontSize: '.92rem', color: fg(.5), lineHeight: 1.8, maxWidth: 560, marginBottom: 48, marginTop: -32 }}>
                    {mapMeta.subtitle || address}
                  </p>
                )}
              </FadeUp>
              <FadeUp delay={.1}>
                {embedRaw ? (
                  <div style={{ overflow: 'hidden', border: `1px solid ${pal.borderHard}`, borderRadius: 16 }}>
                    <iframe src={embedRaw} width="100%" height="400" style={{ border: 'none', display: 'block', filter: lightMode ? 'saturate(.85) contrast(1.05)' : 'invert(.92) hue-rotate(180deg) saturate(.3)' }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade" />
                  </div>
                ) : (
                  <div style={{ border: `1px solid ${pal.borderHard}`, borderRadius: 16, overflow: 'hidden' }}>
                    <VenueMap address={venueLocation} lightMode={lightMode} height={400} borderRadius={0} />
                  </div>
                )}
                {address && !mapMeta.subtitle && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, color: fg(.5), fontSize: '.82rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📍</span>
                    <span>{address}</span>
                  </div>
                )}
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* ── FLOATING WHATSAPP ── */}
      {/* Floating WhatsApp — independent toggle */}
      {on('floating_contact') && contact.phone && <FloatingWhatsApp phone={contact.phone} coupleName={couple_name} primary={primary} onPrimary={onPri} />}

      {/* ── FOOTER ── */}
      <footer className="t1-footer">
        <div>
          {logo && <img src={logo} alt="" style={{ height: 20, objectFit: 'contain', opacity: .6, marginBottom: 8, display: 'block' }} />}
          <div style={{ fontFamily: FONT, fontSize: '1rem', color: fg(.4) }}>{venue?.name}</div>
          {venue?.city && <div style={{ fontSize: '.72rem', color: fg(.28), marginTop: 3 }}>{venue.city}{venue.region ? `, ${venue.region}` : ''}</div>}
        </div>
        <div className="t1-footer-links">
          {venue?.website && <a href={venue.website} target="_blank" rel="noopener">Web</a>}
          {venue?.contact_email && <a href={`mailto:${venue.contact_email}`}>Email</a>}
          {venue?.contact_phone && <a href={`tel:${venue.contact_phone}`}>Teléfono</a>}
        </div>
      </footer>
    </div>
  )
}
