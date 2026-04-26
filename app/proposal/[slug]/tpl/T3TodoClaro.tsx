'use client'
// Template 3 — 📋 Todo Claro
// Visual: Sidebar sticky con números de sección. Diseño profesional como un brochure premium.
// Sections: Hero + sidebar nav, Experience, Inclusions, Packages, Extras, FAQ, CTA

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { buildSingleFontUrl } from '@/lib/fonts'
import { formatDate, formatPrice, isDark, toRgb, FadeUp, extractData, FloatingWhatsApp, AvailabilityBanner, Gallery, IcoPin, IcoCalendar, IcoUsers, IcoChat, IcoBuilding, ivaLabel, InclusionIcon, StarRating, resolveContact, formatZoneCapacities, formatZoneFeatures, VenueRentalGrid, type ProposalData } from './shared'
import { WeddingProposal } from './WeddingProposal'
import VisitBookingModal from '@/components/VisitBookingModal'

const SECTIONS_ALL = [
  { id: 'experience',    label: 'La experiencia' },
  { id: 'zones',         label: 'Los espacios' },
  { id: 'inclusions',    label: 'Qué incluye' },
  { id: 'packages',      label: 'Precios' },
  { id: 'venue_rental',  label: 'Tarifas de alquiler' },
  { id: 'season_prices', label: 'Temporadas' },
  { id: 'menu',          label: 'Menús' },
  { id: 'accommodation', label: 'Alojamiento' },
  { id: 'extras',        label: 'Servicios extra' },
  { id: 'testimonials',  label: 'Testimonios' },
  { id: 'collaborators', label: 'Colaboradores' },
  { id: 'faq',           label: 'Preguntas' },
  { id: 'contact',       label: 'Contacto' },
]

export default function T3TodoClaro({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date, price_estimate, show_price_estimate, venue, branding } = data
  const { sec, on, hasCatering, packagesShow, inclusionsShow, extrasShow, faqShow, expShow, menuShow, menusStructured, menuExtras, appetizersBase, zonesShow, testsShow, seasonsShow, collabsShow, accom } = extractData(data)

  const primary = branding?.primary_color ?? '#1A3A5C'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#fff' : '#111'
  const logo    = branding?.logo_url ?? null
  const font    = (branding as any)?.font_family || 'Cormorant Garamond,Georgia,serif'
  const contact = resolveContact(data)
  const contactOn = on('contact') && (contact.phone || contact.email)

  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone,      setVisitDone]      = useState(false)
  const [heroLoaded, setHeroLoaded] = useState(false)
  const [openFaq, setOpenFaq] = useState<number|null>(null)
  const [activeSection, setActiveSection] = useState('')
  const sectionRefs = useRef<Record<string, HTMLElement|null>>({})

  // Dynamic menu of sections — only those with actual content
  const pkgs = packagesShow.filter((p: any) => p.is_active !== false)
  const SECTIONS_DEF = SECTIONS_ALL.filter(s => {
    switch (s.id) {
      case 'experience':    return on('experience') && !!(expShow as any)?.body
      case 'zones':         return on('zones') && zonesShow.length > 0
      case 'inclusions':    return on('inclusions') && inclusionsShow.length > 0
      case 'packages':      return on('packages')   && pkgs.length > 0
      case 'venue_rental':  return on('venue_rental') && !!sec.venue_rental?.rows?.length
      case 'season_prices': return on('season_prices') && seasonsShow.length > 0
      case 'menu':          return hasCatering && on('menu') && (menusStructured?.length || menuExtras?.length || appetizersBase?.length || menuShow.length > 0)
      case 'accommodation': return on('accommodation') && !!accom
      case 'extras':        return on('extra_services') && extrasShow.length > 0
      case 'testimonials':  return on('testimonials') && testsShow.length > 0
      case 'collaborators': return on('collaborators') && collabsShow.length > 0
      case 'faq':           return on('faq')        && faqShow.length > 0
      case 'contact':       return !!contactOn
      default: return false
    }
  }).map((s, i) => ({ ...s, n: String(i + 1).padStart(2, '0') }))

  // Dynamic numbering for each section header
  const secN = Object.fromEntries(SECTIONS_DEF.map(s => [s.id, s.n])) as Record<string, string>
  const secLbl = (id: string, fallback: string) => `${secN[id] ?? ''}${secN[id] ? ' — ' : ''}${fallback}`

  useEffect(() => {
    createClient().from('proposals').update({ views: (data as any).views + 1 }).eq('id', data.id).then(()=>{})
  }, [])
  useEffect(() => {
    const url = buildSingleFontUrl(font); if (!url) return
    const ex = document.querySelector('link[data-gf-p]')
    if (ex) { ex.setAttribute('href', url); return }
    const l = document.createElement('link'); l.rel='stylesheet'; l.href=url; l.setAttribute('data-gf-p','1')
    document.head.appendChild(l)
  }, [font])

  // Track active section
  useEffect(() => {
    const handler = () => {
      const y = window.scrollY + 160
      let current = ''
      SECTIONS_DEF.forEach(({ id }) => {
        const el = sectionRefs.current[id] || document.getElementById(id === 'menu' ? 'menu' : '')
        if (!el) return
        const top = (el as HTMLElement).getBoundingClientRect().top + window.scrollY
        if (top <= y) current = id
      })
      setActiveSection(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id] || document.getElementById(id)
    if (!el) return
    const top = (el as HTMLElement).getBoundingClientRect().top + window.scrollY - 100
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const wDate   = formatDate(wedding_date)
  const photos  = venue?.photo_urls ?? []
  const hero    = sec.hero_image_url ?? photos[0] ?? null
  const gallery = sec.gallery_urls?.length ? sec.gallery_urls.slice(0, 4) : photos.slice(1, 4)

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth;color-scheme:light}body{-webkit-font-smoothing:antialiased;background:#F8F6F3}
    ::selection{background:rgba(${rgb},.15)}
    /* Layout — sidebar flush-left, content with breathing room */
    .main-layout{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh;max-width:1400px;margin:0 auto;padding:0 clamp(12px,1.5vw,24px) 0 clamp(8px,1vw,16px);gap:clamp(32px,6vw,96px);background:#F8F6F3}
    .sidebar{position:sticky;top:64px;padding:72px 0;align-self:start;height:fit-content;background:#F8F6F3;color:#1a1614}
    .content{padding:72px 0;min-width:0;background:#F8F6F3}
    .sec{padding:72px 0;border-bottom:1px solid rgba(${rgb},.1)}
    .sec:last-child{border-bottom:none}
    /* Sidebar header */
    .side-h{font-family:Inter,sans-serif;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:${primary};margin-bottom:24px;padding-left:12px}
    /* Nav item — grid with left accent bar */
    .nav-item{position:relative;display:grid;grid-template-columns:22px 1fr;align-items:center;gap:12px;padding:12px 10px 12px 12px;border-radius:8px;cursor:pointer;border:none;background:transparent;width:100%;text-align:left;transition:background .15s,color .15s;color:#1a1614;-webkit-appearance:none}
    .nav-item::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:${primary};border-radius:2px;transition:height .2s}
    .nav-item:hover{background:#fff}
    .nav-item.active{background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)}
    .nav-item.active::before{height:65%}
    .side-n{font-family:Inter,sans-serif;font-size:11px;font-weight:600;color:#9a9590;letter-spacing:.08em;transition:color .15s}
    .side-l{font-family:Inter,sans-serif;font-size:14px;color:#1a1614;font-weight:500;transition:color .15s}
    .nav-item:hover .side-n,.nav-item:hover .side-l{color:${primary}}
    .nav-item.active .side-n{color:${primary}}
    .nav-item.active .side-l{color:${primary};font-weight:600}
    /* Info box */
    .side-box{margin-top:36px;margin-left:12px;padding:18px;background:#fff;border-radius:12px;border:1px solid rgba(${rgb},.12);box-shadow:0 2px 12px rgba(0,0,0,.03)}
    .side-box-lbl{font-family:Inter,sans-serif;font-size:10px;color:${primary};text-transform:uppercase;letter-spacing:.14em;margin-bottom:4px}
    .side-box-val-price{font-family:${font};font-size:28px;font-weight:300;color:${primary};line-height:1}
    .side-box-val-n{font-family:Inter,sans-serif;font-size:17px;font-weight:600;color:#1a1614}
    /* Section number */
    .sec-n{font-family:Inter,sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;color:#C8C3BE;margin-bottom:8px}
    .sec-h{font-family:Cormorant Garamond,serif;font-size:clamp(28px,3.5vw,42px);font-weight:400;color:#181410;margin-bottom:36px;line-height:1.1}
    /* Inputs */
    .inp{width:100%;padding:12px 14px;border:1.5px solid #E2DDD8;border-radius:8px;
      font-family:Inter,sans-serif;font-size:14px;color:#1a1614;background:#FAFAF8;
      outline:none;transition:border-color .2s,box-shadow .2s}
    .inp:focus{border-color:${primary};box-shadow:0 0 0 3px rgba(${rgb},.08)}
    .inp::placeholder{color:#C0BAB5}
    /* Buttons */
    .btn{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;
      font-family:Inter,sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
      border:none;border-radius:6px;cursor:pointer;transition:transform .2s,box-shadow .2s}
    .btn:hover{transform:translateY(-2px)}
    .btn:disabled{opacity:.4;cursor:default;transform:none}
    .btn-pri{background:${primary};color:${onPri};box-shadow:0 4px 18px rgba(${rgb},.28)}
    .btn-pri:hover{box-shadow:0 8px 28px rgba(${rgb},.38)}
    .btn-sec{background:transparent;border:1.5px solid #DEDAD5;color:#3a3430}
    .btn-sec:hover{border-color:${primary};color:${primary}}
    /* Field label */
    .flabel{display:block;font-family:Inter,sans-serif;font-size:10px;font-weight:700;
      letter-spacing:.18em;text-transform:uppercase;color:#AAA5A0;margin-bottom:8px}
    /* Inclusion item */
    .inc-row{display:flex;gap:12px;align-items:flex-start;padding:12px 0;border-bottom:1px solid #F5F1EE}
    /* Pkg table row */
    .pkg-row{display:grid;grid-template-columns:1fr auto;align-items:start;padding:24px 28px;
      border:1px solid #EDEAE6;border-radius:12px;background:#fff;transition:border-color .2s,box-shadow .2s}
    .pkg-row:hover{border-color:rgba(${rgb},.3);box-shadow:0 4px 20px rgba(0,0,0,.06)}
    @media(max-width:780px){.main-layout{grid-template-columns:1fr;padding:0 20px}.sidebar{display:none}.content{padding:20px 0}}
  `

  return (
    <div className="tpl-root" style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#F8F6F3', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ══════════════════════════════════════════
          HERO — informational, clean
      ══════════════════════════════════════════ */}
      <section style={{ position: 'relative', height: '100svh', minHeight: 640, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {hero ? (
          <>
            <img src={hero} alt="" onLoad={() => setHeroLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, transition: 'opacity 1.4s', opacity: heroLoaded ? 1 : 0 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.15) 0%, rgba(0,0,0,.35) 55%, rgba(0,0,0,.75) 100%)', zIndex: 1 }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: primary }} />
        )}

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {logo ? <img src={logo} alt="" style={{ height: 24, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />
            : <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>{venue?.name}</span>
          }
          {show_price_estimate && price_estimate && (
            <span style={{ fontFamily: font, fontSize: 20, fontWeight: 300, color: '#fff' }}>{formatPrice(price_estimate)}</span>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 10, padding: '0 48px 44px', maxWidth: 900 }}>
          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginBottom: 12 }}>Propuesta exclusiva</div>
          <h1 style={{ fontFamily: font, fontSize: 'clamp(38px,6vw,72px)', fontWeight: 300, color: '#fff', lineHeight: 1.05, letterSpacing: '-.01em', marginBottom: 16 }}>{couple_name}</h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontFamily: 'Inter,sans-serif', fontSize: 13, color: 'rgba(255,255,255,.5)' }}>
            {venue?.name && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IcoPin width={12} height={12} /> {venue.name}{venue.city?`, ${venue.city}`:''}</span>}
            {wDate && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IcoCalendar width={12} height={12} /> {wDate}</span>}
            {guest_count && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IcoUsers width={12} height={12} /> {guest_count} invitados</span>}
          </div>
        </div>
      </section>


      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} />
      )}

      {/* ══════════════════════════════════════════
          MAIN LAYOUT — sidebar + content
      ══════════════════════════════════════════ */}
      <div className="main-layout">

        {/* ── Sidebar navigation ────────────────── */}
        <aside className="sidebar">
          <div className="side-h">Contenido</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS_DEF.map(({ id, label, n }) => (
              <button key={id} className={`nav-item${activeSection === id ? ' active' : ''}`} onClick={() => scrollTo(id)}>
                <span className="side-n">{n}</span>
                <span className="side-l">{label}</span>
              </button>
            ))}
          </nav>

          {/* Key info box */}
          <div className="side-box">
            {show_price_estimate && price_estimate && (
              <div style={{ marginBottom: 14 }}>
                <div className="side-box-lbl">Estimación</div>
                <div className="side-box-val-price">{formatPrice(price_estimate)}</div>
                {ivaLabel(sec, true) && <div style={{ fontSize: 10, color: '#9a9590', marginTop: 3, letterSpacing: '.05em' }}>{ivaLabel(sec, true)}</div>}
              </div>
            )}
            {guest_count && (
              <div>
                <div className="side-box-lbl">Invitados</div>
                <div className="side-box-val-n">{guest_count}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            {(hasCatering || contactOn) && (
              <button className="btn btn-pri" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                onClick={() => {
                  if (hasCatering) {
                    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    (sectionRefs.current['contact'] ?? document.getElementById('cta'))?.scrollIntoView({ behavior: 'smooth' })
                  }
                }}>
                {hasCatering ? 'Ver menús' : 'Contactar'} →
              </button>
            )}
          </div>
        </aside>


        {/* ── Main content ─────────────────────── */}
        <main className="content">

          {/* Experience */}
          {on('experience') && expShow && (expShow as any).body && (
            <div className="sec" ref={el => { sectionRefs.current['experience'] = el }} id="exp-section">
              <FadeUp>
                <div className="sec-n">{secLbl('experience', 'La experiencia')}</div>
                <h2 className="sec-h">{(expShow as any).title || 'Vuestro día especial'}</h2>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: '#64605C', lineHeight: 1.9, maxWidth: 560 }}>{(expShow as any).body}</p>
              </FadeUp>
              {on('welcome') && personal_message && (
                <FadeUp delay={.1}>
                  <div style={{ marginTop: 36, padding: '24px 28px', borderLeft: `3px solid ${primary}`, background: '#fff', borderRadius: '0 12px 12px 0' }}>
                    <p style={{ fontFamily: font, fontSize: 18, fontStyle: 'italic', fontWeight: 300, color: '#3a3430', lineHeight: 1.75 }}>&ldquo;{personal_message}&rdquo;</p>
                    {venue?.name && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#C8C3BE', marginTop: 12, letterSpacing: '.1em', textTransform: 'uppercase' }}>— {venue.name}</div>}
                  </div>
                </FadeUp>
              )}
            </div>
          )}

          {/* Gallery strip in content */}
          {on('gallery') && gallery.length > 0 && (
            <Gallery photos={gallery} primary={primary} dark={false} />
          )}

          {/* Zones */}
          {on('zones') && zonesShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['zones'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('zones', 'Los espacios')}</div>
                <h2 className="sec-h">Cada rincón, un escenario</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {zonesShow.map((z: any, i: number) => {
                  const zPhoto = z.photos?.[0] || photos[i + 2]
                  const caps = formatZoneCapacities(z)
                  const feats = formatZoneFeatures(z)
                  return (
                    <FadeUp key={i} delay={(i % 3) * .06}>
                      <div style={{ background: '#fff', border: '1px solid #EDEAE6', borderRadius: 12, overflow: 'hidden', height: '100%' }}>
                        <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: '#F5F1EE' }}>
                          {zPhoto
                            ? <img src={zPhoto} alt={z.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                            : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C8C3BE' }}><IcoBuilding width={40} height={40} /></div>
                          }
                        </div>
                        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <h3 style={{ fontFamily: font, fontSize: 19, color: '#181410', fontWeight: 400 }}>{z.name}</h3>
                          {z.description && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12.5, color: '#7a7570', lineHeight: 1.65 }}>{z.description}</p>}
                          {caps.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontFamily: 'Inter,sans-serif', fontSize: 11.5, color: primary, fontWeight: 600 }}>
                              {caps.map((c, ci) => <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoUsers width={10} height={10} />{c}</span>)}
                            </div>
                          )}
                          {feats.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                              {feats.map((f, fi) => (
                                <span key={fi} style={{ fontFamily: 'Inter,sans-serif', fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: '#F5F1EE', color: '#6a6560' }}>{f}</span>
                              ))}
                            </div>
                          )}
                          {z.notes && <div style={{ fontSize: 11.5, color: '#9a9590', fontStyle: 'italic', marginTop: 2 }}>{z.notes}</div>}
                          {z.price && <div style={{ fontFamily: font, fontSize: 15, color: primary, marginTop: 4 }}>{z.price}</div>}
                        </div>
                      </div>
                    </FadeUp>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inclusions */}
          {on('inclusions') && inclusionsShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['inclusions'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('inclusions', 'Qué incluye')}</div>
                <h2 className="sec-h">Todo incluido</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 0 }} className="two-col">
                {inclusionsShow.map((inc:any, i:number) => (
                  <FadeUp key={i} delay={(i%2)*.05}>
                    <div className="inc-row">
                      <span style={{ flexShrink: 0, display: 'inline-flex', color: primary, marginTop: 1 }}><InclusionIcon name={inc.icon || inc.emoji || 'check'} size={20} color={primary} /></span>
                      <div>
                        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: '#2a2420' }}>{inc.title}</div>
                        {inc.description && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#9a9590', marginTop: 2, lineHeight: 1.5 }}>{inc.description}</div>}
                      </div>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* Packages */}
          {on('packages') && pkgs.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['packages'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('packages', 'Paquetes y precios')}</div>
                <h2 className="sec-h">Nuestra propuesta económica</h2>
              </FadeUp>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pkgs.map((pkg:any, i:number) => (
                  <FadeUp key={i} delay={i*.07}>
                    <div className="pkg-row">
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                          <h3 style={{ fontFamily: font, fontSize: 24, fontWeight: 400, color: '#181410' }}>{pkg.name}</h3>
                          {pkg.is_recommended && <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 9, fontWeight: 700, color: primary, background: `rgba(${rgb},.1)`, padding: '3px 10px', borderRadius: 100, letterSpacing: '.12em', textTransform: 'uppercase' }}>Recomendado</span>}
                        </div>
                        {pkg.description && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#7a7570', lineHeight: 1.7, marginBottom: 12 }}>{pkg.description}</p>}
                        {pkg.includes?.filter(Boolean).length > 0 && (
                          <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '6px 16px' }}>
                            {pkg.includes.filter(Boolean).map((item:string, j:number) => (
                              <li key={j} style={{ display: 'flex', gap: 7, fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#3a3430', alignItems: 'flex-start' }}>
                                <span style={{ color: primary, fontWeight: 700, flexShrink: 0, fontSize: 10, marginTop: 2 }}>✓</span>{item}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {pkg.price && (
                        <div style={{ textAlign: 'right', paddingLeft: 24 }}>
                          <div style={{ fontFamily: font, fontSize: 'clamp(28px,3.5vw,40px)', fontWeight: 300, color: primary, lineHeight: 1 }}>{pkg.price}</div>
                        </div>
                      )}
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* Venue rental (grid temporada × día) */}
          {on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['venue_rental'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('venue_rental', sec.venue_rental.title || 'Tarifas de alquiler')}</div>
                <h2 className="sec-h">Elegid vuestra fecha</h2>
              </FadeUp>
              <FadeUp delay={.1}>
                <VenueRentalGrid data={sec.venue_rental} primary={primary} />
              </FadeUp>
            </div>
          )}

          {/* Season prices */}
          {on('season_prices') && seasonsShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['season_prices'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('season_prices', 'Temporadas')}</div>
                <h2 className="sec-h">Precios según la fecha</h2>
              </FadeUp>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #EDEAE6', overflow: 'hidden' }}>
                {seasonsShow.map((s: any, i: number) => (
                  <FadeUp key={i} delay={i * .05}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'center', padding: '18px 24px', borderBottom: i < seasonsShow.length - 1 ? '1px solid #F0EDE9' : 'none' }}>
                      <div style={{ fontFamily: font, fontSize: 17, color: '#181410' }}>{s.label || s.season}</div>
                      <div>
                        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: primary, marginBottom: 3 }}>{s.date_range}</div>
                        {s.notes && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#9a9590' }}>{s.notes}</div>}
                      </div>
                      <div style={{ fontFamily: font, fontSize: 18, color: primary, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.price_modifier}</div>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* WeddingProposal — configuración interactiva */}
          {hasCatering && on('menu') && (menusStructured?.length || menuExtras?.length || appetizersBase?.length || menuShow.length > 0) && (
            <WeddingProposal
              data={data}
              menus={menusStructured}
              extras={menuExtras}
              appetizers={appetizersBase}
              legacyMenus={menuShow}
              primary={primary}
              onPrimary={onPri}
            />
          )}

          {/* Accommodation */}
          {on('accommodation') && accom && (
            <div className="sec" ref={el => { sectionRefs.current['accommodation'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('accommodation', 'Alojamiento')}</div>
                <h2 className="sec-h">Quedaos a dormir</h2>
              </FadeUp>
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #EDEAE6', padding: '28px 32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 28 }}>
                <FadeUp>
                  <div>
                    {accom.description && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: '#64605C', lineHeight: 1.8, marginBottom: 14 }}>{accom.description}</p>}
                    {accom.rooms && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {accom.rooms.split('·').map((r: string, i: number) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter,sans-serif', fontSize: 13, color: '#3a3430' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />{r.trim()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </FadeUp>
                <FadeUp delay={.1}>
                  {Array.isArray(accom.options) && accom.options.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {accom.options.map((opt: any, oi: number) => (
                        <div key={oi} style={{ borderLeft: `2px solid ${primary}`, paddingLeft: 12 }}>
                          <div style={{ fontFamily: font, fontSize: 16, color: '#181410' }}>{opt.label}</div>
                          {opt.description && <div style={{ fontSize: 12, color: '#9a9590', marginTop: 3 }}>{opt.description}</div>}
                          {opt.included ? (
                            <div style={{ fontSize: 12, color: primary, fontWeight: 600, marginTop: 4 }}>✓ Incluido en la tarifa del venue</div>
                          ) : opt.price_info ? (
                            <div style={{ fontSize: 13, color: '#3a3430', marginTop: 4 }}>{opt.price_info}</div>
                          ) : Array.isArray(opt.prices) && opt.prices.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                              {opt.prices.map((p: any, pi: number) => (
                                <div key={pi} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: '#3a3430' }}>
                                  <span style={{ flex: 1 }}>{p.season}</span>
                                  <span style={{ fontFamily: font, color: primary }}>{p.price}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : accom.price_info ? (
                    <p style={{ fontSize: 14, color: '#3a3430', lineHeight: 1.8 }}>{accom.price_info}</p>
                  ) : null}
                  {accom.nearby && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0EDE9' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#AAA5A0', marginBottom: 6 }}>Alojamientos cercanos</div>
                      <p style={{ fontSize: 12.5, color: '#7a7570', lineHeight: 1.7 }}>{accom.nearby}</p>
                    </div>
                  )}
                </FadeUp>
              </div>
            </div>
          )}

          {/* Extra services */}
          {on('extra_services') && extrasShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['extras'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('extras', 'Servicios adicionales')}</div>
                <h2 className="sec-h">Personaliza tu celebración</h2>
              </FadeUp>
              {extrasShow.map((svc:any, i:number) => (
                <FadeUp key={i} delay={i*.04}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #F0EDE9', gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: '#2a2420' }}>{svc.name}</div>
                      {svc.description && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#9a9590', marginTop: 2 }}>{svc.description}</div>}
                    </div>
                    {svc.price && <span style={{ fontFamily: font, fontSize: 20, fontWeight: 300, color: primary, whiteSpace: 'nowrap' }}>{svc.price}</span>}
                  </div>
                </FadeUp>
              ))}
            </div>
          )}

          {/* Testimonials */}
          {on('testimonials') && testsShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['testimonials'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('testimonials', 'Lo dicen las parejas')}</div>
                <h2 className="sec-h">Experiencias reales</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {testsShow.map((t: any, i: number) => {
                  const name = t.couple_name || t.names || ''
                  const rawDate = t.wedding_date || t.date
                  const dateStr = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? formatDate(rawDate) : rawDate
                  return (
                    <FadeUp key={i} delay={i * .06}>
                      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #EDEAE6', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
                        <div style={{ color: '#F5A623', fontSize: 13 }}><StarRating rating={t.rating ?? 5} size={13} color="#F5A623" /></div>
                        <p style={{ fontFamily: font, fontStyle: 'italic', fontSize: 15, lineHeight: 1.7, color: '#3a3430', flex: 1 }}>"{t.text}"</p>
                        <div style={{ paddingTop: 10, borderTop: '1px solid #F0EDE9' }}>
                          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 13, fontWeight: 600, color: '#181410' }}>{name}</div>
                          {dateStr && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: primary, marginTop: 2, letterSpacing: '.08em', textTransform: 'uppercase' }}>{dateStr}</div>}
                        </div>
                      </div>
                    </FadeUp>
                  )
                })}
              </div>
            </div>
          )}

          {/* Collaborators */}
          {on('collaborators') && collabsShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['collaborators'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('collaborators', 'Colaboradores')}</div>
                <h2 className="sec-h">Proveedores de confianza</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {collabsShow.map((c: any, i: number) => (
                  <FadeUp key={i} delay={(i % 4) * .04}>
                    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #EDEAE6', padding: '16px 18px', height: '100%' }}>
                      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 6 }}>{c.category}</div>
                      <div style={{ fontFamily: font, fontSize: 16, color: '#181410', marginBottom: 3 }}>{c.name}</div>
                      {c.description && <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#7a7570', lineHeight: 1.55 }}>{c.description}</div>}
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          {on('faq') && faqShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['faq'] = el }}>
              <FadeUp>
                <div className="sec-n">{secLbl('faq', 'Dudas frecuentes')}</div>
                <h2 className="sec-h">Preguntas y respuestas</h2>
              </FadeUp>
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #EDEAE6', overflow: 'hidden' }}>
                {faqShow.map((item:any, i:number) => (
                  <div key={i} style={{ borderBottom: i<faqShow.length-1?'1px solid #F0EDE9':'none' }}>
                    <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 16 }}>
                      <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, fontWeight: 500, color: '#2a2420' }}>{item.question}</span>
                      <span style={{ color: primary, fontSize: 20, fontWeight: 200, flexShrink: 0, transition: 'transform .25s', transform: openFaq===i?'rotate(45deg)':'none' }}>+</span>
                    </button>
                    <div style={{ maxHeight: openFaq===i?400:0, overflow: 'hidden', transition: 'max-height .4s cubic-bezier(.22,1,.36,1)' }}>
                      <p style={{ padding: '0 24px 20px', fontFamily: 'Inter,sans-serif', fontSize: 14, color: '#7a7570', lineHeight: 1.8 }}>{item.answer}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agendar visita */}
          {on('schedule_visit') && (() => {
            const sv = (sec as any).schedule_visit ?? {}
            const svUrl   = sv.url
            const svTitle = sv.title    || 'Visitadnos en persona'
            const svSub   = sv.subtitle || 'Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue.'
            const svCta   = sv.cta_label || 'Reservar visita gratuita →'
            return (
              <div className="sec" style={{ textAlign: 'center' }}>
                <FadeUp>
                  <div style={{ maxWidth: 520, margin: '0 auto' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <div className="sec-n">Visita</div>
                    <h2 className="sec-h" style={{ fontFamily: font }}>{svTitle}</h2>
                    <p style={{ fontSize: '.95rem', color: '#6A6A6A', lineHeight: 1.7, marginBottom: 32 }}>{svSub}</p>
                    {visitDone ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: `${primary}18`, border: `1px solid ${primary}44`, borderRadius: 8, padding: '12px 24px', fontSize: '.88rem', color: primary, fontWeight: 600 }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ¡Solicitud enviada! Os confirmaremos la visita pronto.
                      </div>
                    ) : svUrl ? (
                      <a href={svUrl} target="_blank" rel="noopener"
                        style={{ display: 'inline-block', background: primary, color: onPri, padding: '13px 32px', borderRadius: 6, fontSize: '.88rem', fontWeight: 600, textDecoration: 'none', letterSpacing: '.04em' }}>
                        {svCta}
                      </a>
                    ) : (
                      <button onClick={() => setVisitModalOpen(true)}
                        style={{ background: primary, color: onPri, padding: '13px 32px', borderRadius: 6, fontSize: '.88rem', fontWeight: 600, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>
                        {svCta}
                      </button>
                    )}
                    {sv.note && <p style={{ fontSize: '.78rem', color: '#9A9A9A', marginTop: 14 }}>{sv.note}</p>}
                  </div>
                </FadeUp>
              </div>
            )
          })()}

          {visitModalOpen && (
            <VisitBookingModal
              proposalId={data.id}
              coupleName={couple_name}
              primaryColor={primary}
              selectedSpaces={[]}
              onClose={() => setVisitModalOpen(false)}
              onSuccess={() => { setVisitModalOpen(false); setVisitDone(true) }}
            />
          )}

          {/* Map */}
          {on('map') && (sec.map_embed_url || (data.venueContent.map_info as any)?.embed_url) && (() => {
            const embed = sec.map_embed_url || (data.venueContent.map_info as any).embed_url
            const address = sec.map_address || (data.venueContent.map_info as any)?.address
            return (
              <div className="sec">
                <FadeUp>
                  <div className="sec-n">{secLbl('map', 'Ubicación')}</div>
                  <h2 className="sec-h">Cómo llegar</h2>
                  {address && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: '#64605C', marginTop: -20, marginBottom: 24 }}>{address}</p>}
                </FadeUp>
                <FadeUp delay={.1}>
                  <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #EDEAE6' }}>
                    <iframe src={embed} width="100%" height="300" style={{ border: 'none', display: 'block' }} loading="lazy" allowFullScreen />
                  </div>
                </FadeUp>
              </div>
            )
          })()}

          {/* Contact — only when section is on */}
          {contactOn && (
            <div className="sec" ref={el => { sectionRefs.current['contact'] = el }} id="cta">
              <FadeUp>
                <div className="sec-n">{secLbl('contact', 'Contacto')}</div>
                <h2 className="sec-h">¿Tenéis alguna duda?</h2>
              </FadeUp>
              <FadeUp delay={.1}>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 14, color: '#7a7570', lineHeight: 1.8, marginBottom: 24, maxWidth: 520 }}>
                  Escribidnos por WhatsApp o email y os respondemos en menos de 24 horas.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, maxWidth: 720 }}>
                  {contact.phone && (
                    <a href={`https://wa.me/${contact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, he visto la propuesta para ${couple_name} y me gustaría hablar con vosotros.`)}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#25D366', color: '#fff', borderRadius: 10, textDecoration: 'none', fontFamily: 'Inter,sans-serif' }}>
                      <IcoChat width={22} height={22} style={{ flexShrink: 0 }} />
                      <div style={{ lineHeight: 1.2 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>Escríbenos por WhatsApp</div>
                        <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>{contact.phone}</div>
                      </div>
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Propuesta ${couple_name}`)}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#fff', color: '#1a1614', border: `1.5px solid ${primary}`, borderRadius: 10, textDecoration: 'none', fontFamily: 'Inter,sans-serif' }}>
                      <span style={{ color: primary, display: 'inline-flex', flexShrink: 0 }}>
                        <InclusionIcon name="mail" size={22} color={primary} strokeWidth={1.8} />
                      </span>
                      <div style={{ lineHeight: 1.2 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>Escríbenos por email</div>
                        <div style={{ fontSize: 12, color: '#6a6560', marginTop: 2, wordBreak: 'break-all' }}>{contact.email}</div>
                      </div>
                    </a>
                  )}
                </div>
              </FadeUp>
            </div>
          )}
        </main>
      </div>

      {/* ── FLOATING WHATSAPP ── */}
      {contactOn && <FloatingWhatsApp phone={contact.phone} coupleName={couple_name} primary={primary} onPrimary={onPri} />}

      {/* Footer */}
      <footer style={{ background: '#181410', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          {logo && <img src={logo} alt="" style={{ height: 22, objectFit: 'contain', opacity: .65, display: 'block', marginBottom: 8 }} />}
          {venue?.name && <div style={{ fontFamily: font, fontSize: 16, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>{venue.name}</div>}
        </div>
        <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: 'rgba(255,255,255,.15)' }}>
          <a href="https://weddingvenuesspain.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>Wedding Venues Spain</a>
        </div>
      </footer>
    </div>
  )
}
