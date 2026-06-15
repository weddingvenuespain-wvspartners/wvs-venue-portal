'use client'
// Template 2 — ✨ Emoción Primero
// Visual: Calor, luz, editorial. La galería como protagonista. Todo en crema y serif.
// Sections: Hero minimal, Gallery (full-bleed), Mensaje personal, Experiencia, Testimonios, Incluye, CTA romántico

import { useEffect, useState, useRef } from 'react'
import { safeCssColor, safeFontFamily } from '@/lib/utils'
import { buildSingleFontUrl } from '@/lib/fonts'
import { formatDate, isDark, toRgb, FadeUp, FadeIn, extractData, FloatingWhatsApp, AvailabilityBanner, Gallery, GalleryMosaic, GalleryGrid, IcoChat, IcoBuilding, IcoUsers, InclusionIcon, StarRating, resolveContact, formatZoneCapacities, formatZoneFeatures, formatZonePrice, VenueRentalGrid, TplStickyNav, TplVenueSpecs, TplSingleSpace, TplWelcomeLight, TplWelcomeSplit, TplWelcomeEditorial, pickWelcomeVariant, replacePlaceholders, ZoneSlider, InclusionsGrid, InclusionsList, InclusionsCards, TestimonialsCards, TestimonialsQuotes, TestimonialsCompact, TestimonialsFeatured, FaqAccordion, FaqCards, FaqNumbered, PricingCards, PricingTable, type ProposalData } from './shared'
import { getActiveStyle } from '@/lib/section-styles'
import { WeddingProposal } from './WeddingProposal'
import VisitBookingModal from '@/components/VisitBookingModal'
import SpaceGroupSelector, { type SpaceSelection } from './SpaceGroupSelector'
import InquiryForm from '@/components/InquiryForm'
import DateSelector from './DateSelector'

function EmptySec({ label }: { label: string }) {
  return (
    <section style={{ padding: '24px 0' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '14px 22px', border: '1.5px dashed rgba(0,0,0,.15)', borderRadius: 10, color: 'rgba(0,0,0,.3)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, opacity: .5 }}>+</span>
          <span><b style={{ color: 'rgba(0,0,0,.45)', fontWeight: 600 }}>{label}</b> — sección activa, añade contenido para verla</span>
        </div>
      </div>
    </section>
  )
}

export default function T2Emocion({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date, price_estimate, show_price_estimate, venue, branding } = data
  const { sec, on, hasCatering, packagesShow, inclusionsShow, testsShow, extrasShow, expShow, faqShow, menuShow, menusStructured, menuExtras, appetizersBase, zonesShow, zonesMode, seasonsShow, collabsShow, accom, spaceGroups, techspecs, dateSlots } = extractData(data)
  const [selectedSpaces, setSelectedSpaces] = useState<SpaceSelection[]>([])
  const guests = guest_count ? Number(guest_count) : undefined
  const visibleSpaceGroups = (spaceGroups ?? []).filter(g => {
    if (guests === undefined) return true
    if (g.min_guests && guests < g.min_guests) return false
    if (g.max_guests && guests > g.max_guests) return false
    return true
  })
  const displayMsg = replacePlaceholders(data.personal_message || (sec as any).welcome_default || null, data)
  const welcomeVariant = pickWelcomeVariant(sec)
  const _preview = !!(data as any)._preview

  const primary = safeCssColor(branding?.primary_color, '#4A6B52')!
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#ffffff' : '#111111'
  const logo    = branding?.logo_url ?? null
  const font    = safeFontFamily((branding as any)?.font_family, "'Inter', system-ui, sans-serif")!
  const contact = resolveContact(data)
  const contactOn = on('contact') && (contact.phone || contact.email)
  const photoList = venue?.photo_urls ?? []
  const scrollToContact = () => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })

  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone,      setVisitDone]      = useState(false)
  const [selectedDateSlotIdx, setSelectedDateSlotIdx] = useState<number | null>(null)
  const [selectedExtraSvcs, setSelectedExtraSvcs] = useState<Record<string, boolean>>({})
  const [selectedZoneSupplements, setSelectedZoneSupplements] = useState<Record<number, boolean>>({})
  const [selectedMenus, setSelectedMenus] = useState<string[]>([])
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const heroImgRef = useRef<HTMLImageElement>(null)
  useEffect(() => { if (heroImgRef.current?.complete) setHeroLoaded(true) }, [])
  const [openFaq, setOpenFaq] = useState<number|null>(null)

  useEffect(() => {
    const url = buildSingleFontUrl(font); if (!url) return
    const ex = document.querySelector('link[data-gf-p]')
    if (ex) { ex.setAttribute('href', url); return }
    const l = document.createElement('link'); l.rel='stylesheet'; l.href=url; l.setAttribute('data-gf-p','1')
    document.head.appendChild(l)
  }, [font])

  const wDate   = formatDate(wedding_date)
  const photos  = venue?.photo_urls ?? []
  const hero    = sec.hero_image_url ?? photos[0] ?? null
  const gallery = sec.gallery_urls?.length ? sec.gallery_urls : photos.slice(1, 7)
  const pkgs    = packagesShow.filter((p:any) => p.is_active !== false)

  const CREAM = '#FEF8F0'
  const WARM  = '#F7EEE3'

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Inter:wght@300;400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}body{-webkit-font-smoothing:antialiased}
    ::selection{background:rgba(${rgb},.18)}
    .w{max-width:860px;margin:0 auto;padding:0 48px}
    .w-full{max-width:1200px;margin:0 auto;padding:0 32px}
    /* Typography */
    .serif{font-family:Inter,system-ui,sans-serif}
    .sans{font-family:Inter,system-ui,sans-serif}
    .t2-eyebrow{display:flex;align-items:center;justify-content:center;gap:12px;font-family:Inter,sans-serif;font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${primary};margin-bottom:18px}
    .t2-eyebrow::before,.t2-eyebrow::after{content:'';width:20px;height:1px;background:rgba(${rgb},.25)}
    /* Hero animations */
    @keyframes hf{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
    .hc1{animation:hf 1s .3s both}.hc2{animation:hf 1s .6s both}.hc3{animation:hf 1s .9s both}
    /* Gallery hover */
    .gimg{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.22,1,.36,1)}
    .gcell:hover .gimg{transform:scale(1.06)}
    /* Inputs */
    .inp{width:100%;padding:14px 0;border:none;border-bottom:1px solid rgba(${rgb},.3);
      background:transparent;font-family:Inter,system-ui,sans-serif;font-size:15px;
      color:#3a2f28;outline:none;transition:border-color .2s}
    .inp:focus{border-color:${primary}}
    .inp::placeholder{color:rgba(58,47,40,.35);font-style:italic}
    /* Button */
    .btn-em{background:none;border:1.5px solid ${primary};color:${primary};
      padding:16px 40px;font-family:Inter,sans-serif;font-size:12px;font-weight:600;
      letter-spacing:.14em;text-transform:uppercase;cursor:pointer;
      transition:background .25s,color .25s}
    .btn-em:hover{background:${primary};color:${onPri}}
    .btn-em:disabled{opacity:.4;cursor:default}
    /* Divider ornament */
    .orn{display:flex;align-items:center;justify-content:center;gap:12px;margin:0 auto}
    .orn::before,.orn::after{content:'';flex:1;height:1px;background:rgba(${rgb},.25)}
    @media(max-width:680px){.w{padding:0 24px}.w-full{padding:0 20px}.two-col{grid-template-columns:1fr!important}}
    #cta .inp{color:rgba(255,255,255,.9);border-bottom-color:rgba(255,255,255,.25)}
    #cta .inp::placeholder{color:rgba(255,255,255,.38)}
    #cta .inp:focus{border-bottom-color:rgba(255,255,255,.7)}
  `

  const stickyLinks = ([
    welcomeVariant && displayMsg ? { label: 'Bienvenida', anchor: 'sec-welcome' } : null,
    on('experience') && (expShow as any)?.body ? { label: 'Historia', anchor: 'sec-experience' } : null,
    on('gallery') && gallery.length > 0 ? { label: 'Galería', anchor: 'sec-gallery' } : null,
    on('single_space') && (sec as any).single_space?.title ? { label: 'Espacio', anchor: 'sec-single-space' } : null,
    on('zones') && zonesShow.length > 0 ? { label: 'Espacios', anchor: 'sec-zones' } : null,
    hasCatering ? { label: 'Menús', anchor: 'menu' } : null,
    on('schedule_visit') ? { label: 'Visita', anchor: 'sec-schedule' } : null,
    contactOn ? { label: 'Contacto', anchor: 'cta' } : null,
  ].filter(Boolean) as { label: string; anchor: string }[])

  return (
    <div className="tpl-root" style={{ fontFamily: font, background: CREAM, color: '#2c2418', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── STICKY NAV ── */}
      {on('sticky_nav') && (
        <TplStickyNav
          venueName={venue?.name}
          logoUrl={logo}
          primary={primary}
          bg={CREAM}
          fg="#2c2418"
          fontSerif={font}
          links={stickyLinks}
        />
      )}

      {/* ══════════════════════════════════════════
          HERO — minimal, image is everything
      ══════════════════════════════════════════ */}
      <section style={{ position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hero ? (
          <>
            <img ref={heroImgRef} src={hero} alt="" onLoad={() => setHeroLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', zIndex: 0, transition: 'opacity 1.8s ease', opacity: heroLoaded ? 1 : 0 }} />
            {/* Overlay — color + opacity from template settings */}
            {(() => {
              const oColor = (sec as any).hero_overlay_color ?? '#140e08'
              const oAlpha = (sec as any).hero_overlay_opacity ?? 0.5
              const cr = parseInt(oColor.slice(1,3),16), cg = parseInt(oColor.slice(3,5),16), cb = parseInt(oColor.slice(5,7),16)
              const a = (f: number) => Math.min(1, oAlpha * f).toFixed(2)
              return <>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, rgba(${cr},${cg},${cb},${a(0.7)}) 0%, rgba(${cr},${cg},${cb},${a(1.1)}) 50%, rgba(${cr},${cg},${cb},${a(1.3)}) 100%)`, zIndex: 1 }} />
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, transparent 35%, rgba(${cr},${cg},${cb},${a(1)}) 100%)`, zIndex: 2 }} />
              </>
            })()}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#1a0e08' }} />
        )}

        {/* Centered content */}
        {(() => {
          const heroTitleColor = (sec as any).hero_title_color ?? '#ffffff'
          const heroSubColor = (sec as any).hero_subtitle_color ?? '#ffffff'
          const sr = parseInt(heroSubColor.slice(1,3),16), sg = parseInt(heroSubColor.slice(3,5),16), sb = parseInt(heroSubColor.slice(5,7),16)
          const subFull = heroSubColor
          const subLabel = `rgba(${sr},${sg},${sb},.6)`
          return (
            <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px' }}>
              <div className="hc1" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', marginBottom: 22 }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: '.68rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#fff' }}>
                  Vuestra propuesta
                </span>
                {venue?.name && (
                  <>
                    <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,.3)' }} />
                    <span style={{ fontFamily: "'Inter',sans-serif", fontSize: '.68rem', fontWeight: 500, color: 'rgba(255,255,255,.85)' }}>{venue.name}</span>
                  </>
                )}
              </div>
              <h1 className="hc2 serif" style={{ fontSize: 'clamp(52px,9vw,96px)', fontWeight: 300, color: heroTitleColor, lineHeight: 1.0, letterSpacing: '-.01em', marginBottom: 24, fontStyle: 'italic', textShadow: '0 2px 24px rgba(0,0,0,.5)' }}>
                {couple_name}
              </h1>
            </div>
          )
        })()}

      </section>


      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} guestCount={guests} weddingDate={dateSlots && dateSlots.flatMap(s => s.dates).length > 1 ? undefined : (wedding_date ?? undefined)} />
      )}

      {/* ── DATE SELECTOR ── */}
      {on('date_slots') && dateSlots && dateSlots.length > 1 && !(on('space_groups') && visibleSpaceGroups.length > 0) && (
        <section style={{ padding: '40px 0', background: '#faf8f5' }}>
          <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 32px' }}>
            <DateSelector slots={dateSlots} primary={primary} onPrimary={onPri} dark={false} font={font} proposalId={data.id} onSelect={setSelectedDateSlotIdx} guestCount={guests} />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          GALLERY — full-bleed, immediately
      ══════════════════════════════════════════ */}
      {on('gallery') && (gallery.length > 0 ? (() => {
        const galleryStyle = getActiveStyle(sec, 'gallery')
        const GalleryComp  = galleryStyle === 'mosaic' ? GalleryMosaic : galleryStyle === 'grid' ? GalleryGrid : Gallery
        return (
          <section id="sec-gallery">
            <FadeIn>
              <GalleryComp photos={gallery} primary={primary} dark={false} />
            </FadeIn>
          </section>
        )
      })() : _preview ? <EmptySec label="Galería" /> : null)}


      {/* ══════════════════════════════════════════
          PERSONAL MESSAGE — variantes (default / light / split / editorial)
      ══════════════════════════════════════════ */}
      {welcomeVariant === 'welcome' && displayMsg && (
        <section id="sec-welcome" style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
                <div className="serif" style={{ fontSize: 120, fontWeight: 300, color: `rgba(${rgb},.1)`, lineHeight: 1, marginBottom: -28, fontStyle: 'italic' }}>"</div>
                <p className="serif" style={{ fontSize: 'clamp(21px,3.2vw,28px)', fontWeight: 300, fontStyle: 'italic', color: '#3a2f28', lineHeight: 1.8, marginBottom: 36 }}>
                  {displayMsg}
                </p>
                <div className="orn" style={{ maxWidth: 280 }}>
                  {venue?.name && <span className="sans" style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: `rgba(${rgb},.5)` }}>{venue.name}</span>}
                </div>
              </div>
            </FadeUp>
          </div>
        </section>
      )}
      {welcomeVariant === 'welcome_light' && displayMsg && (
        <TplWelcomeLight
          message={displayMsg}
          venueName={venue?.name}
          imageUrl={(sec as any).welcome_light?.image_url}
          primary={primary}
          bg={WARM}
          fg="#2c2418"
          font={font}
        />
      )}
      {welcomeVariant === 'welcome_split' && displayMsg && (
        <TplWelcomeSplit
          message={displayMsg}
          venueName={venue?.name}
          imageUrl={(sec as any).welcome_split?.image_url}
          imageSide={(sec as any).welcome_split?.image_side}
          primary={primary}
          bg={CREAM}
          fg="#2c2418"
          font={font}
        />
      )}
      {welcomeVariant === 'welcome_editorial' && displayMsg && (
        <TplWelcomeEditorial
          message={displayMsg}
          venueName={venue?.name}
          eyebrow={(sec as any).welcome_editorial?.eyebrow}
          primary={primary}
          bg="#fff"
          fg="#2c2418"
          font={font}
        />
      )}


      {/* ══════════════════════════════════════════
          EXPERIENCE — full width editorial text
      ══════════════════════════════════════════ */}
      {on('experience') && expShow && (expShow as any).body && (
        <section id="sec-experience" style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <div className="t2-eyebrow">{(expShow as any).eyebrow || 'La experiencia'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic', lineHeight: 1.1 }}>
                  {(expShow as any).title || 'Vuestro día especial'}
                </h2>
              </div>
            </FadeUp>
            <FadeUp delay={.12}>
              <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
                <p className="serif" style={{ fontSize: 'clamp(17px,2.2vw,21px)', fontWeight: 300, color: '#5a4a3a', lineHeight: 1.9, fontStyle: 'italic' }}>
                  {(expShow as any).body}
                </p>
              </div>
            </FadeUp>
          </div>
        </section>
      )}


      {/* ── VENUE SPECS ── */}
      {on('venue_specs') && (
        <TplVenueSpecs
          specs={(sec as any).venue_specs}
          fallbackArea={techspecs?.sqm?.split('·')[0]?.trim() ?? null}
          primary={primary}
          fg="#2c2418"
          font={font}
          label="Datos del venue"
        />
      )}

      {/* ── SINGLE SPACE ── */}
      {on('single_space') && (
        <TplSingleSpace
          data={(sec as any).single_space}
          fallbackImage={hero}
          primary={primary}
          bg="#fff"
          fg="#2c2418"
          font={font}
          label="El espacio"
        />
      )}

      {/* ══════════════════════════════════════════
          ZONES
      ══════════════════════════════════════════ */}
      {on('zones') && (zonesShow.length > 0 ? (
        <section id="sec-zones" style={{ background: CREAM, padding: '100px 0' }}>
          <div className="w-full">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <div className="t2-eyebrow">{(sec as any).zones_header?.label || 'Espacios'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>{(sec as any).zones_header?.title || 'Cada rincón del venue'}</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 24, alignItems: 'stretch' }}>
              {zonesShow.map((z: any, i: number) => {
                const zPhotos: string[] = z.photos?.length ? z.photos : (photoList[i + 2] ? [photoList[i + 2]] : [])
                const caps = formatZoneCapacities(z)
                const feats = formatZoneFeatures(z)
                const hasSuppl = zonesMode === 'zones' && !!z.price
                const suppSel = !!selectedZoneSupplements[i]
                return (
                  <FadeUp key={i} delay={(i % 3) * .08} style={{ height: '100%', display: 'flex' }}>
                    <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', border: `1.5px solid ${hasSuppl && suppSel ? primary : `rgba(${rgb},.1)`}`, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: WARM, flexShrink: 0 }}>
                        {zPhotos.length > 0
                          ? <ZoneSlider photos={zPhotos} name={z.name} />
                          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `rgba(${rgb},.3)` }}><IcoBuilding width={48} height={48} /></div>
                        }
                      </div>
                      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                        {z.subtitle && <div className="sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 2 }}>{z.subtitle}</div>}
                        <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, color: '#2c2418', fontStyle: 'italic' }}>{z.name}</h3>
                        {z.description && <p className="sans" style={{ fontSize: 13, color: '#6a5a4a', lineHeight: 1.7 }}>{z.description}</p>}
                        {caps.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: primary, fontWeight: 600 }}>
                            {caps.map((c, ci) => <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoUsers width={11} height={11} /> {c}</span>)}
                          </div>
                        )}
                        {feats.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                            {feats.map((f, fi) => (
                              <span key={fi} className="sans" style={{ fontSize: 11, padding: '3px 9px', border: `1px solid rgba(${rgb},.2)`, borderRadius: 999, color: `rgba(${rgb},.7)`, letterSpacing: '.03em' }}>{f}</span>
                            ))}
                          </div>
                        )}
                        {z.notes && <div className="sans" style={{ fontSize: 12, color: '#8a7060', fontStyle: 'italic', marginTop: 4 }}>{z.notes}</div>}
                        {hasSuppl && (
                          <button type="button" onClick={() => setSelectedZoneSupplements(p => ({ ...p, [i]: !p[i] }))}
                            style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 6, border: `1.5px solid ${suppSel ? primary : `rgba(${rgb},.25)`}`, background: suppSel ? primary : 'transparent', color: suppSel ? (isDark(primary) ? '#fff' : '#111') : `rgba(${rgb},.8)`, fontSize: 12, fontWeight: 700, letterSpacing: '.04em', cursor: 'pointer', transition: 'all .2s' }}>
                            {suppSel ? '✓ Añadido' : '+ Añadir'} · {formatZonePrice(z.price)}
                          </button>
                        )}
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      ) : _preview ? <EmptySec label="Espacios" /> : null)}

      {/* ── SPACE GROUPS ── */}
      {on('space_groups') && visibleSpaceGroups.length > 0 ? (
        <div id="sec-space-groups">
          <SpaceGroupSelector
            groups={visibleSpaceGroups}
            primary={primary}
            onPrimary={onPri}
            dark={false}
            font={font}
            guestCount={guests}
            onSelectionChange={setSelectedSpaces}
            pricingBlock={(() => {
              const blocks: React.ReactNode[] = []
              if (on('date_slots') && dateSlots && dateSlots.length > 1) {
                blocks.push(<DateSelector key="ds" slots={dateSlots} primary={primary} onPrimary={onPri} dark={false} font={font} proposalId={data.id} onSelect={setSelectedDateSlotIdx} guestCount={guests} />)
              }
              if (on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0) {
                blocks.push(
                  <div key="vr">
                    <div className="t2-eyebrow">{sec.venue_rental.title || 'Elegid vuestra fecha'}</div>
                    <VenueRentalGrid data={sec.venue_rental} primary={primary} />
                  </div>
                )
              }
              return blocks.length > 0 ? <>{blocks}</> : undefined
            })()}
          />
        </div>
      ) : null}

      {/* ══════════════════════════════════════════
          SEASON PRICES
      ══════════════════════════════════════════ */}
      {on('season_prices') && (seasonsShow.length > 0 ? (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="t2-eyebrow">{(sec as any).season_prices_eyebrow || 'Temporadas'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Precios según la fecha</h2>
              </div>
            </FadeUp>
            <div style={{ background: '#fff', borderRadius: 4 }}>
              {seasonsShow.map((s: any, i: number) => (
                <FadeUp key={i} delay={i * .06}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 20, alignItems: 'center', padding: '20px 28px', borderBottom: i < seasonsShow.length - 1 ? `1px solid rgba(${rgb},.08)` : 'none' }}>
                    <div className="serif" style={{ fontSize: 17, color: '#2c2418', fontWeight: 400 }}>{s.label || s.season}</div>
                    <div>
                      <div className="sans" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: primary, marginBottom: 3 }}>{s.date_range}</div>
                      {s.notes && <div className="sans" style={{ fontSize: 12, color: '#8a7060' }}>{s.notes}</div>}
                    </div>
                    <div className="serif" style={{ fontSize: 18, color: primary, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.price_modifier}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      ) : _preview ? <EmptySec label="Temporadas" /> : null)}

      {/* ══════════════════════════════════════════
          TESTIMONIALS — 4 variantes (cards/quotes/compact/featured)
      ══════════════════════════════════════════ */}
      {on('testimonials') && (testsShow.length > 0 ? (() => {
        const variant = getActiveStyle(sec, 'testimonials')
        const Comp = variant === 'cards'    ? TestimonialsCards
                   : variant === 'compact'  ? TestimonialsCompact
                   : variant === 'featured' ? TestimonialsFeatured
                   : TestimonialsQuotes  // default for T2 = quotes editorial
        return (
          <section style={{ background: '#fff', padding: '100px 0' }}>
            <div className="w">
              <FadeUp>
                <div style={{ textAlign: 'center', marginBottom: 64 }}>
                  <div className="t2-eyebrow">{(sec as any).testimonials_eyebrow || 'Testimonios'}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(30px,4.5vw,48px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>
                    Bodas en {venue?.name ?? 'nuestro espacio'}
                  </h2>
                </div>
              </FadeUp>
              <Comp items={testsShow} primary={primary} dark={false} font={font} />
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="Testimoniales" /> : null)}


      {/* ══════════════════════════════════════════
          INCLUSIONS — 3 variantes (grid/list/cards)
      ══════════════════════════════════════════ */}
      {on('inclusions') && (inclusionsShow.length > 0 ? (() => {
        const variant = getActiveStyle(sec, 'inclusions')
        const Comp = variant === 'list' ? InclusionsList : variant === 'cards' ? InclusionsCards : InclusionsGrid
        return (
          <section style={{ background: WARM, padding: '100px 0' }}>
            <div className="w">
              <FadeUp>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                  <div className="t2-eyebrow">{(sec as any).inclusions_eyebrow || 'Qué incluye'}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Todo para vuestra boda perfecta</h2>
                </div>
              </FadeUp>
              <Comp items={inclusionsShow as any} primary={primary} dark={false} columns={3} />
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="Qué incluye" /> : null)}


      {/* ══════════════════════════════════════════
          PACKAGES — elegant cards
      ══════════════════════════════════════════ */}
      {/* PAQUETES — 3 variantes (cards/table/rental_grid) */}
      {on('pricing') && (() => {
        const variant = getActiveStyle(sec, 'pricing')
        const hasRentalRows = ((sec as any).venue_rental?.rows?.length ?? 0) > 0 && ((sec as any).venue_rental?.day_tiers?.length ?? 0) > 0
        const hasContent = pkgs.length > 0 || (variant === 'rental_grid' && hasRentalRows)
        if (!hasContent) return _preview ? <EmptySec label="Paquetes" /> : null
        return (
          <section style={{ background: '#fff', padding: '100px 0' }}>
            <div className="w">
              <FadeUp>
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                  <div className="t2-eyebrow">{(sec as any).pricing_eyebrow || 'Paquetes'}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,48px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Nuestra propuesta para vosotros</h2>
                </div>
              </FadeUp>
              {variant === 'table' ? (
                <PricingTable packages={pkgs as any} primary={primary} dark={false} font={font} />
              ) : variant === 'rental_grid' && hasRentalRows ? (
                <VenueRentalGrid data={(sec as any).venue_rental} primary={primary} />
              ) : (
                <PricingCards packages={pkgs as any} primary={primary} dark={false} font={font}
                  selectedId={selectedPackageId} onSelect={(id) => setSelectedPackageId(id)} />
              )}
            </div>
          </section>
        )
      })()}


      {/* ══════════════════════════════════════════
          CONFIGURA VUESTRA BODA (WeddingProposal)
      ══════════════════════════════════════════ */}
      {hasCatering && on('menu') && (() => {
        // Filter menus by selected package's linked_menu_ids (if commercial config uses packages)
        const pkg = pkgs.find((p: any) => p.id === selectedPackageId) as any
        const linked: string[] | null = pkg?.linked_menu_ids ?? null
        const hasPackages = pkgs.length > 0 && (data as any).commercialConfig?.price_model === 'package'
        // If config is package-based and no package picked yet → don't show menus
        if (hasPackages && !selectedPackageId) {
          return (
            <section id="menu" style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--cream)' }}>
              <div className="t2-eyebrow">Menús</div>
              <h2 className="serif" style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic', marginTop: 8 }}>
                Elige primero un paquete arriba para ver los menús disponibles
              </h2>
            </section>
          )
        }
        // Filter menus if package has linked_menu_ids restriction
        const filterMenus = <T extends { id?: string }>(arr: T[] | undefined): T[] => {
          if (!arr) return [] as T[]
          if (!linked || linked.length === 0) return arr
          return arr.filter(m => m.id && linked.includes(m.id))
        }
        const fMenusStructured = filterMenus(menusStructured as any[])
        const fMenuShow        = filterMenus(menuShow as any[])
        if (!(fMenusStructured.length || menuExtras?.length || appetizersBase?.length || fMenuShow.length)) return null
        return (
          <WeddingProposal
            data={data}
            menus={fMenusStructured as any}
            extras={menuExtras}
            appetizers={appetizersBase}
            legacyMenus={fMenuShow as any}
            primary={primary}
            onPrimary={onPri}
            onMenusChange={setSelectedMenus}
          />
        )
      })()}

      {/* ══════════════════════════════════════════
          ACCOMMODATION
      ══════════════════════════════════════════ */}
      {on('accommodation') && accom && (() => {
        const accomVariant = getActiveStyle(sec, 'accommodation')
        return (
        <section data-variant={accomVariant} style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="t2-eyebrow">{(sec as any).accommodation_eyebrow || 'Alojamiento'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>{accomVariant === 'interactive' ? 'Reservad vuestras habitaciones' : 'Quedaos a dormir'}</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 32, alignItems: 'start' }}>
              <FadeUp>
                <div>
                  {accom.description && <p className="serif" style={{ fontSize: 16, color: '#5a4a3a', lineHeight: 1.85, fontStyle: 'italic', marginBottom: 18 }}>{accom.description}</p>}
                  {accom.rooms && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {accom.rooms.split('·').map((r: string, i: number) => (
                        <div key={i} className="sans" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#5a4a3a' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />{r.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FadeUp>
              <FadeUp delay={.1}>
                {Array.isArray(accom.options) && accom.options.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {accom.options.map((opt: any, oi: number) => (
                      <div key={oi} style={{ borderLeft: `2px solid ${primary}`, paddingLeft: 14 }}>
                        <div className="serif" style={{ fontSize: 17, color: '#2c2418' }}>{opt.label}</div>
                        {opt.description && <div className="sans" style={{ fontSize: 13, color: '#8a7060', marginTop: 3 }}>{opt.description}</div>}
                        {opt.included ? (
                          <div className="sans" style={{ fontSize: 12, color: primary, fontWeight: 600, marginTop: 5 }}>✓ Incluido en la tarifa del venue</div>
                        ) : opt.price_info ? (
                          <div className="sans" style={{ fontSize: 13, color: '#5a4a3a', marginTop: 4 }}>{opt.price_info}</div>
                        ) : Array.isArray(opt.prices) && opt.prices.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {opt.prices.map((p: any, pi: number) => (
                              <div key={pi} className="sans" style={{ display: 'flex', gap: 10, fontSize: 13, color: '#5a4a3a' }}>
                                <span style={{ flex: 1 }}>{p.season}</span>
                                <span className="serif" style={{ color: primary }}>{p.price}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : accom.price_info ? (
                  <p className="sans" style={{ fontSize: 14, color: '#5a4a3a', lineHeight: 1.8 }}>{accom.price_info}</p>
                ) : null}
                {accom.nearby && (
                  <div style={{ marginTop: 18, paddingTop: 18, borderTop: `1px solid rgba(${rgb},.15)` }}>
                    <div className="sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: `rgba(${rgb},.5)`, marginBottom: 8 }}>Alojamientos cercanos</div>
                    <p className="sans" style={{ fontSize: 13, color: '#8a7060', lineHeight: 1.7 }}>{accom.nearby}</p>
                  </div>
                )}
              </FadeUp>
            </div>
          </div>
        </section>
        )
      })()}

      {/* ══════════════════════════════════════════
          EXTRA SERVICES
      ══════════════════════════════════════════ */}
      {on('extra_services') && (extrasShow.length > 0 ? (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="t2-eyebrow">{(sec as any).extra_services_eyebrow || 'Servicios adicionales'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Servicios adicionales</h2>
              </div>
            </FadeUp>
            {extrasShow.map((svc: any, i: number) => {
              const isSel = !!selectedExtraSvcs[svc.name]
              const toggle = () => setSelectedExtraSvcs(p => ({ ...p, [svc.name]: !p[svc.name] }))
              return (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: `1px solid rgba(${rgb},.1)`, gap: 20, cursor: 'pointer' }} onClick={toggle}>
                    <div style={{ flex: 1 }}>
                      <div className="serif" style={{ fontSize: 17, fontWeight: 400, color: '#2c2418' }}>{svc.name}</div>
                      {svc.description && <div className="sans" style={{ fontSize: 13, color: '#8a7060', marginTop: 3 }}>{svc.description}</div>}
                    </div>
                    {svc.price && <span className="serif" style={{ fontSize: 20, color: primary, whiteSpace: 'nowrap' }}>{svc.price}</span>}
                    <button type="button" onClick={e => { e.stopPropagation(); toggle() }}
                      style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', border: `1.5px solid ${isSel ? primary : 'rgba(0,0,0,.2)'}`, background: isSel ? primary : 'transparent', color: isSel ? '#fff' : 'rgba(0,0,0,.4)', fontSize: isSel ? '.7rem' : '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .15s' }}>
                      {isSel ? '✓' : '+'}
                    </button>
                  </div>
                </FadeUp>
              )
            })}
          </div>
        </section>
      ) : _preview ? <EmptySec label="Servicios adicionales" /> : null)}

      {/* ══════════════════════════════════════════
          COLLABORATORS
      ══════════════════════════════════════════ */}
      {on('collaborators') && (collabsShow.length > 0 ? (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w-full">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="t2-eyebrow">{(sec as any).collaborators_eyebrow || 'Proveedores de confianza'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Nuestros colaboradores</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, maxWidth: 960, margin: '0 auto' }}>
              {collabsShow.map((c: any, i: number) => (
                <FadeUp key={i} delay={(i % 4) * .05}>
                  <div style={{ background: '#fff', padding: '22px 24px', borderRadius: 4, border: `1px solid rgba(${rgb},.1)`, height: '100%', ...(c.exclusive ? { borderLeft: `3px solid ${primary}` } : {}) }}>
                    {c.exclusive && <div className="sans" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: primary, marginBottom: 6 }}>★ Exclusivo</div>}
                    <div className="sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 8 }}>{c.category}</div>
                    <div className="serif" style={{ fontSize: 17, fontWeight: 400, color: '#2c2418', marginBottom: 4 }}>{c.name}</div>
                    {c.description && <div className="sans" style={{ fontSize: 12, color: '#8a7060', lineHeight: 1.6 }}>{c.description}</div>}
                    {c.price_info && <div className="sans" style={{ fontSize: 12, color: '#8a7060', marginTop: 6, fontStyle: 'italic' }}>{c.price_info}</div>}
                    {(c.phone || c.website || c.instagram || c.email) && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                        {c.phone && <a href={`tel:${c.phone}`} className="sans" style={{ fontSize: 11, color: primary, textDecoration: 'none' }}>{c.phone}</a>}
                        {c.website && <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer" className="sans" style={{ fontSize: 11, color: primary, textDecoration: 'none' }}>Web ↗</a>}
                        {c.instagram && <a href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="sans" style={{ fontSize: 11, color: primary, textDecoration: 'none' }}>@{c.instagram.replace('@', '')}</a>}
                        {c.email && <a href={`mailto:${c.email}`} className="sans" style={{ fontSize: 11, color: primary, textDecoration: 'none' }}>{c.email}</a>}
                      </div>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      ) : _preview ? <EmptySec label="Colaboradores" /> : null)}

      {/* FAQ — 3 variantes (accordion/cards/numbered) */}
      {on('faq') && (faqShow.length > 0 ? (() => {
        const variant = getActiveStyle(sec, 'faq')
        const Comp = variant === 'cards' ? FaqCards : variant === 'numbered' ? FaqNumbered : FaqAccordion
        return (
          <section style={{ background: '#fff', padding: '100px 0' }}>
            <div className="w">
              <FadeUp>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <div className="t2-eyebrow">{(sec as any).faq_eyebrow || 'Preguntas frecuentes'}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Preguntas y respuestas</h2>
                </div>
              </FadeUp>
              <Comp items={faqShow as any} primary={primary} dark={false} />
            </div>
          </section>
        )
      })() : _preview ? <EmptySec label="FAQ" /> : null)}

      {/* ══════════════════════════════════════════
          AGENDAR VISITA
      ══════════════════════════════════════════ */}
      {on('schedule_visit') && (() => {
        const sv = (sec as any).schedule_visit ?? {}
        const variant = getActiveStyle(sec, 'schedule_visit')
        const svTitle = sv.title || (variant === 'cta' ? 'Visitadnos en persona' : 'Agendar visita')
        const svSub   = sv.subtitle || (variant === 'cta'
          ? 'Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue.'
          : 'Selecciona qué prefieres y rellena tus datos. Si quieres venir a visitarnos, podrás elegir directamente fecha y hora disponibles.')

        if (variant === 'cta') {
          const svUrl = sv.url
          const svCta = sv.cta_label || 'Reservar visita gratuita →'
          const svTextColor = sv.cta_text_color || onPri
          return (
            <section id="sec-schedule" style={{ padding: '100px 0', background: '#FAF7F2', textAlign: 'center' }}>
              <FadeUp>
                <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 24px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <h2 style={{ fontFamily: font, fontSize: 'clamp(1.8rem,3vw,2.6rem)', color: '#2A1F1A', marginBottom: 16, lineHeight: 1.2 }}>{svTitle}</h2>
                  <p style={{ fontSize: '1rem', color: '#7A6A5A', lineHeight: 1.7, marginBottom: 36 }}>{svSub}</p>
                  {visitDone ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 10, padding: '14px 28px', fontSize: '.9rem', color: primary, fontWeight: 600 }}>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ¡Solicitud enviada! Os confirmaremos la visita pronto.
                    </div>
                  ) : svUrl ? (
                    <a href={svUrl} target="_blank" rel="noopener"
                      style={{ display: 'inline-block', background: primary, color: svTextColor, padding: '14px 36px', borderRadius: 6, fontSize: '.9rem', fontWeight: 600, textDecoration: 'none', letterSpacing: '.04em' }}>
                      {svCta}
                    </a>
                  ) : (
                    <button onClick={() => setVisitModalOpen(true)}
                      style={{ background: primary, color: svTextColor, padding: '14px 36px', borderRadius: 6, fontSize: '.9rem', fontWeight: 600, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>
                      {svCta}
                    </button>
                  )}
                  {sv.note && <p style={{ fontSize: '.8rem', color: '#9A8A7A', marginTop: 16 }}>{sv.note}</p>}
                  <p style={{ fontSize: '.78rem', color: '#9A8A7A', marginTop: 20, lineHeight: 1.7, maxWidth: 400, margin: '20px auto 0' }}>
                    Al reservar la visita, vuestras selecciones se incluyen en la solicitud para que preparemos un presupuesto personalizado.
                  </p>
                </div>
              </FadeUp>
            </section>
          )
        }

        const svKinds = Array.isArray(sv.kinds) && sv.kinds.length > 0 ? sv.kinds : undefined
        return (
          <section id="sec-schedule" style={{ padding: '100px 0', background: '#FAF7F2' }}>
            <FadeUp>
              <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
                <h2 style={{ fontFamily: font, fontSize: 'clamp(1.8rem,3vw,2.6rem)', color: '#2A1F1A', marginBottom: 16, lineHeight: 1.2 }}>{svTitle}</h2>
                <p style={{ fontSize: '1rem', color: '#7A6A5A', lineHeight: 1.7, marginBottom: 36 }}>{svSub}</p>
              </div>
            </FadeUp>
            <FadeUp delay={.1}>
              <InquiryForm slug={data.slug} proposalId={data.id} coupleName={couple_name} kinds={svKinds} primary={primary} onPrimary={onPri} dark={false} />
            </FadeUp>
          </section>
        )
      })()}

      {visitModalOpen && (
        <VisitBookingModal
          proposalId={data.id}
          coupleName={couple_name}
          primaryColor={primary}
          selectedSpaces={selectedSpaces}
          selectedMenus={selectedMenus}
          selectedExtraSvcs={[
            ...Object.entries(selectedExtraSvcs).filter(([,v]) => v).map(([k]) => k),
            ...zonesShow.filter((z: any, i: number) => zonesMode === 'zones' && z.price && selectedZoneSupplements[i]).map((z: any) => `${z.name} (${formatZonePrice(z.price)})`),
          ]}
          spaceGroups={visibleSpaceGroups.length > 0 ? visibleSpaceGroups : undefined}
          dateSlots={dateSlots ?? []}
          preSelectedDateSlot={selectedDateSlotIdx}
          onClose={() => setVisitModalOpen(false)}
          onSuccess={() => { setVisitModalOpen(false); setVisitDone(true) }}
        />
      )}

      {/* ══════════════════════════════════════════
          MAPA
      ══════════════════════════════════════════ */}
      {on('map') && (sec.map_embed_url || (data.venueContent.map_info as any)?.embed_url) && (() => {
        const embed = sec.map_embed_url || (data.venueContent.map_info as any).embed_url
        const address = sec.map_address || (data.venueContent.map_info as any)?.address
        return (
          <section style={{ background: WARM, padding: '100px 0' }}>
            <div className="w">
              <FadeUp>
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                  <div className="t2-eyebrow">{(sec as any).map_eyebrow || 'Ubicación'}</div>
                  <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Cómo llegar</h2>
                  {address && <p className="sans" style={{ fontSize: 13, color: '#8a7060', marginTop: 14 }}>{address}</p>}
                </div>
              </FadeUp>
              <FadeUp delay={.1}>
                <div style={{ overflow: 'hidden', borderRadius: 4, border: `1px solid rgba(${rgb},.12)` }}>
                  <iframe src={embed} width="100%" height="360" style={{ border: 'none', display: 'block' }} loading="lazy" allowFullScreen />
                </div>
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* ── FLOATING WHATSAPP ── */}
      {on('floating_contact') && contactOn && <FloatingWhatsApp phone={contact.phone} coupleName={couple_name} primary={primary} onPrimary={onPri} />}

      {/* Footer */}
      <footer style={{ background: '#1a0e08', padding: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          {logo && <img src={logo} alt="" style={{ height: 24, objectFit: 'contain', opacity: .7, display: 'block', marginBottom: 10 }} />}
          {venue?.name && <div className="serif" style={{ fontSize: 18, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>{venue.name}</div>}
        </div>
        <div className="sans" style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>
          <a href="https://weddingvenuesspain.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>FOREVENTOS</a>
        </div>
      </footer>
    </div>
  )
}
