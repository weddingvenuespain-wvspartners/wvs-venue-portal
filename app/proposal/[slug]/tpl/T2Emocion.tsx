'use client'
// Template 2 — ✨ Emoción Primero
// Visual: Calor, luz, editorial. La galería como protagonista. Todo en crema y serif.
// Sections: Hero minimal, Gallery (full-bleed), Mensaje personal, Experiencia, Testimonios, Incluye, CTA romántico

import { useEffect, useState, useRef } from 'react'
import { buildSingleFontUrl } from '@/lib/fonts'
import { formatDate, isDark, toRgb, FadeUp, FadeIn, extractData, FloatingWhatsApp, AvailabilityBanner, Gallery, IcoChat, IcoBuilding, IcoUsers, InclusionIcon, StarRating, resolveContact, formatZoneCapacities, formatZoneFeatures, VenueRentalGrid, type ProposalData } from './shared'
import { WeddingProposal } from './WeddingProposal'
import VisitBookingModal from '@/components/VisitBookingModal'

export default function T2Emocion({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date, price_estimate, show_price_estimate, venue, branding } = data
  const { sec, on, hasCatering, packagesShow, inclusionsShow, testsShow, extrasShow, expShow, faqShow, menuShow, menusStructured, menuExtras, appetizersBase, zonesShow, seasonsShow, collabsShow, accom } = extractData(data)

  const primary = branding?.primary_color ?? '#6B4F3A'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#fff' : '#111'
  const logo    = branding?.logo_url ?? null
  const font    = (branding as any)?.font_family || 'Cormorant Garamond,Georgia,serif'
  const contact = resolveContact(data)
  const contactOn = on('contact') && (contact.phone || contact.email)
  const photoList = venue?.photo_urls ?? []
  const scrollToContact = () => document.getElementById('cta')?.scrollIntoView({ behavior: 'smooth' })

  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone,      setVisitDone]      = useState(false)
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
    .serif{font-family:Cormorant Garamond,Georgia,serif}
    .sans{font-family:Inter,system-ui,sans-serif}
    /* Hero animations */
    @keyframes hf{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
    .hc1{animation:hf 1s .3s both}.hc2{animation:hf 1s .6s both}.hc3{animation:hf 1s .9s both}
    /* Gallery hover */
    .gimg{width:100%;height:100%;object-fit:cover;display:block;transition:transform .8s cubic-bezier(.22,1,.36,1)}
    .gcell:hover .gimg{transform:scale(1.06)}
    /* Inputs */
    .inp{width:100%;padding:14px 0;border:none;border-bottom:1px solid rgba(${rgb},.3);
      background:transparent;font-family:Cormorant Garamond,serif;font-size:17px;
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

  return (
    <div className="tpl-root" style={{ fontFamily: font, background: CREAM, color: '#2c2418', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ══════════════════════════════════════════
          HERO — minimal, image is everything
      ══════════════════════════════════════════ */}
      <section style={{ position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hero ? (
          <>
            <img ref={heroImgRef} src={hero} alt="" onLoad={() => setHeroLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', zIndex: 0, transition: 'opacity 1.8s ease', opacity: heroLoaded ? 1 : 0 }} />
            {/* Darker overlay + vertical gradient for readable text on bright images */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(20,14,8,.35) 0%, rgba(20,14,8,.55) 50%, rgba(20,14,8,.65) 100%)', zIndex: 1 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.5) 100%)', zIndex: 2 }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#1a0e08' }} />
        )}

        {/* Top-left logo */}
        {logo && (
          <div className="hc1" style={{ position: 'absolute', top: 28, left: 32, zIndex: 11 }}>
            <img src={logo} alt="" style={{ height: 32, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />
          </div>
        )}

        {/* Centered content */}
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px' }}>
          <div className="hc1 sans" style={{ fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>
            Una propuesta especial para
          </div>
          <h1 className="hc2 serif" style={{ fontSize: 'clamp(52px,9vw,96px)', fontWeight: 300, color: '#fff', lineHeight: 1.0, letterSpacing: '-.01em', marginBottom: 28, fontStyle: 'italic', textShadow: '0 2px 24px rgba(0,0,0,.5)' }}>
            {couple_name}
          </h1>
          <div className="hc3" style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 20 }}>
            {wDate && <span className="sans" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', fontStyle: 'normal' }}>{wDate}</span>}
            {guest_count && <span className="sans" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>· {guest_count} invitados</span>}
            {venue?.name && <span className="sans" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)' }}>· {venue.name}{venue.city?`, ${venue.city}`:''}</span>}
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 1, height: 56, background: 'rgba(255,255,255,.3)' }} />
          <span className="sans" style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>Desliza</span>
        </div>
      </section>


      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} />
      )}

      {/* ══════════════════════════════════════════
          GALLERY — full-bleed, immediately
      ══════════════════════════════════════════ */}
      {on('gallery') && gallery.length > 0 && (
        <section>
          <FadeIn>
            <Gallery photos={gallery} primary={primary} dark={false} />
          </FadeIn>
        </section>
      )}


      {/* ══════════════════════════════════════════
          PERSONAL MESSAGE — editorial quote
      ══════════════════════════════════════════ */}
      {on('welcome') && personal_message && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
                <div className="serif" style={{ fontSize: 120, fontWeight: 300, color: `rgba(${rgb},.1)`, lineHeight: 1, marginBottom: -28, fontStyle: 'italic' }}>"</div>
                <p className="serif" style={{ fontSize: 'clamp(21px,3.2vw,28px)', fontWeight: 300, fontStyle: 'italic', color: '#3a2f28', lineHeight: 1.8, marginBottom: 36 }}>
                  {personal_message}
                </p>
                <div className="orn" style={{ maxWidth: 280 }}>
                  {venue?.name && <span className="sans" style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: `rgba(${rgb},.5)` }}>{venue.name}</span>}
                </div>
              </div>
            </FadeUp>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          EXPERIENCE — full width editorial text
      ══════════════════════════════════════════ */}
      {on('experience') && expShow && (expShow as any).body && (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 52 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 20 }}>La experiencia</div>
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


      {/* ══════════════════════════════════════════
          ZONES
      ══════════════════════════════════════════ */}
      {on('zones') && zonesShow.length > 0 && (
        <section style={{ background: CREAM, padding: '100px 0' }}>
          <div className="w-full">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Los espacios</div>
                <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Cada rincón del venue</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px,1fr))', gap: 24, alignItems: 'stretch' }}>
              {zonesShow.map((z: any, i: number) => {
                const zPhoto = z.photos?.[0] || photoList[i + 2]
                const caps = formatZoneCapacities(z)
                const feats = formatZoneFeatures(z)
                return (
                  <FadeUp key={i} delay={(i % 3) * .08} style={{ height: '100%', display: 'flex' }}>
                    <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', border: `1px solid rgba(${rgb},.1)`, display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: WARM, flexShrink: 0 }}>
                        {zPhoto
                          ? <img src={zPhoto} alt={z.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `rgba(${rgb},.3)` }}><IcoBuilding width={48} height={48} /></div>
                        }
                      </div>
                      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
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
                        {z.price && <div className="serif" style={{ fontSize: 16, color: primary, marginTop: 4 }}>{z.price}</div>}
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          VENUE RENTAL — grid temporada × día
      ══════════════════════════════════════════ */}
      {on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0 && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>{sec.venue_rental.title || 'Tarifas de alquiler'}</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Elegid vuestra fecha</h2>
              </div>
            </FadeUp>
            <FadeUp delay={.1}>
              <VenueRentalGrid data={sec.venue_rental} primary={primary} />
            </FadeUp>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          SEASON PRICES
      ══════════════════════════════════════════ */}
      {on('season_prices') && seasonsShow.length > 0 && (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Temporadas</div>
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
      )}

      {/* ══════════════════════════════════════════
          TESTIMONIALS — large editorial quotes
      ══════════════════════════════════════════ */}
      {on('testimonials') && testsShow.length > 0 && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 64 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Lo que dicen las parejas</div>
                <h2 className="serif" style={{ fontSize: 'clamp(30px,4.5vw,48px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>
                  Bodas en {venue?.name ?? 'nuestro espacio'}
                </h2>
              </div>
            </FadeUp>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 72 }}>
              {testsShow.map((t:any, i:number) => (
                <FadeUp key={i} delay={i*.08}>
                  <div style={{ maxWidth: 700, margin: i%2===0?'0 0 0 auto':'0 auto 0 0', textAlign: i%2===0?'right':'left' }}>
                    <div style={{ marginBottom: 20 }}><StarRating rating={t.rating ?? 5} size={16} color="#C9A96E" /></div>
                    <p className="serif" style={{ fontSize: 'clamp(20px,3vw,26px)', fontWeight: 300, fontStyle: 'italic', color: '#2c2418', lineHeight: 1.75, marginBottom: 28 }}>
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: i%2===0?'flex-end':'flex-start' }}>
                      {t.photo_url && <img src={t.photo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />}
                      <div>
                        <div className="sans" style={{ fontSize: 13, fontWeight: 500, color: '#3a2f28' }}>{t.couple_name||t.names}</div>
                        {(t.wedding_date||t.date) && <div className="sans" style={{ fontSize: 11, color: `rgba(${rgb},.5)`, marginTop: 1 }}>{t.wedding_date||t.date}</div>}
                      </div>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          INCLUSIONS — clean centered grid
      ══════════════════════════════════════════ */}
      {on('inclusions') && inclusionsShow.length > 0 && (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Qué incluye</div>
                <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,46px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Todo para vuestra boda perfecta</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 28 }}>
              {inclusionsShow.map((inc:any, i:number) => (
                <FadeUp key={i} delay={(i%4)*.06}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', marginBottom: 14, color: primary }}>
                      <InclusionIcon name={inc.icon || inc.emoji || 'check'} size={32} color={primary} strokeWidth={1.4} />
                    </div>
                    <div className="serif" style={{ fontSize: 17, fontWeight: 500, color: '#2c2418', marginBottom: 6 }}>{inc.title}</div>
                    {inc.description && <div className="sans" style={{ fontSize: 12, color: `rgba(${rgb},.65)`, lineHeight: 1.6 }}>{inc.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          PACKAGES — elegant cards
      ══════════════════════════════════════════ */}
      {on('packages') && pkgs.length > 0 && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Paquetes</div>
                <h2 className="serif" style={{ fontSize: 'clamp(30px,4vw,48px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Nuestra propuesta para vosotros</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {pkgs.map((pkg:any, i:number) => (
                <FadeUp key={i} delay={i*.08}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 40, alignItems: 'center', padding: '36px 0', borderBottom: '1px solid rgba(58,47,40,.12)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h3 className="serif" style={{ fontSize: 28, fontWeight: 400, color: '#2c2418' }}>{pkg.name}</h3>
                        {pkg.is_recommended && <span className="sans" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, background: `rgba(${rgb},.08)`, padding: '4px 12px', borderRadius: 100 }}>Recomendado</span>}
                      </div>
                      {pkg.description && <p className="sans" style={{ fontSize: 14, color: '#8a7060', lineHeight: 1.7, marginBottom: pkg.includes?.filter(Boolean).length>0?16:0 }}>{pkg.description}</p>}
                      {pkg.includes?.filter(Boolean).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
                          {pkg.includes.filter(Boolean).map((item:string, j:number) => (
                            <span key={j} className="sans" style={{ fontSize: 13, color: '#5a4a3a', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ color: primary, fontSize: 10 }}>✦</span>{item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {pkg.price && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div className="serif" style={{ fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 300, color: primary }}>{pkg.price}</div>
                      </div>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}


      {/* ══════════════════════════════════════════
          CONFIGURA VUESTRA BODA (WeddingProposal)
      ══════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════
          ACCOMMODATION
      ══════════════════════════════════════════ */}
      {on('accommodation') && accom && (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Alojamiento</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Quedaos a dormir</h2>
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
      )}

      {/* ══════════════════════════════════════════
          EXTRA SERVICES
      ══════════════════════════════════════════ */}
      {on('extra_services') && extrasShow.length > 0 && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Servicios adicionales</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Personaliza tu celebración</h2>
              </div>
            </FadeUp>
            {extrasShow.map((svc: any, i: number) => (
              <FadeUp key={i} delay={i * .04}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0', borderBottom: `1px solid rgba(${rgb},.1)`, gap: 20 }}>
                  <div>
                    <div className="serif" style={{ fontSize: 17, fontWeight: 400, color: '#2c2418' }}>{svc.name}</div>
                    {svc.description && <div className="sans" style={{ fontSize: 13, color: '#8a7060', marginTop: 3 }}>{svc.description}</div>}
                  </div>
                  {svc.price && <span className="serif" style={{ fontSize: 20, color: primary, whiteSpace: 'nowrap' }}>{svc.price}</span>}
                </div>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          COLLABORATORS
      ══════════════════════════════════════════ */}
      {on('collaborators') && collabsShow.length > 0 && (
        <section style={{ background: WARM, padding: '100px 0' }}>
          <div className="w-full">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Proveedores de confianza</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Nuestros colaboradores</h2>
              </div>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {collabsShow.map((c: any, i: number) => (
                <FadeUp key={i} delay={(i % 4) * .05}>
                  <div style={{ background: '#fff', padding: '22px 24px', borderRadius: 4, border: `1px solid rgba(${rgb},.1)`, height: '100%' }}>
                    <div className="sans" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 8 }}>{c.category}</div>
                    <div className="serif" style={{ fontSize: 17, fontWeight: 400, color: '#2c2418', marginBottom: 4 }}>{c.name}</div>
                    {c.description && <div className="sans" style={{ fontSize: 12, color: '#8a7060', lineHeight: 1.6 }}>{c.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          FAQ
      ══════════════════════════════════════════ */}
      {on('faq') && faqShow.length > 0 && (
        <section style={{ background: '#fff', padding: '100px 0' }}>
          <div className="w">
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Dudas frecuentes</div>
                <h2 className="serif" style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 300, color: '#2c2418', fontStyle: 'italic' }}>Preguntas y respuestas</h2>
              </div>
            </FadeUp>
            <div>
              {faqShow.map((item: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ borderBottom: `1px solid rgba(${rgb},.12)` }}>
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', gap: 16 }}>
                      <span className="serif" style={{ fontSize: 17, fontWeight: 400, color: openFaq === i ? primary : '#2c2418', fontStyle: 'italic' }}>{item.question}</span>
                      <span style={{ fontSize: 22, color: primary, flexShrink: 0, fontWeight: 200, transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
                    </button>
                    <div style={{ overflow: 'hidden', maxHeight: openFaq === i ? 400 : 0, transition: 'max-height .35s cubic-bezier(.4,0,.2,1)' }}>
                      <p className="sans" style={{ fontSize: 14, color: '#6a5a4a', lineHeight: 1.8, paddingBottom: 22 }}>{item.answer}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          AGENDAR VISITA
      ══════════════════════════════════════════ */}
      {on('schedule_visit') && (() => {
        const sv = (sec as any).schedule_visit ?? {}
        const svUrl   = sv.url
        const svTitle = sv.title    || 'Visitadnos en persona'
        const svSub   = sv.subtitle || 'Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue.'
        const svCta   = sv.cta_label || 'Reservar visita gratuita →'
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
                    style={{ display: 'inline-block', background: primary, color: onPri, padding: '14px 36px', borderRadius: 6, fontSize: '.9rem', fontWeight: 600, textDecoration: 'none', letterSpacing: '.04em' }}>
                    {svCta}
                  </a>
                ) : (
                  <button onClick={() => setVisitModalOpen(true)}
                    style={{ background: primary, color: onPri, padding: '14px 36px', borderRadius: 6, fontSize: '.9rem', fontWeight: 600, border: 'none', cursor: 'pointer', letterSpacing: '.04em' }}>
                    {svCta}
                  </button>
                )}
                {sv.note && <p style={{ fontSize: '.8rem', color: '#9A8A7A', marginTop: 16 }}>{sv.note}</p>}
              </div>
            </FadeUp>
          </section>
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
                  <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: `rgba(${rgb},.6)`, marginBottom: 16 }}>Ubicación</div>
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

      {/* ══════════════════════════════════════════
          CTA — romantic, soft (contacto directo)
      ══════════════════════════════════════════ */}
      {contactOn && (
        <section id="cta" style={{ position: 'relative', padding: '120px 0', overflow: 'hidden' }}>
          {hero && (
            <>
              <img src={hero} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'brightness(.3) saturate(.5)' }} />
              <div style={{ position: 'absolute', inset: 0, background: `rgba(${toRgb('#2c1a0e')},.7)`, zIndex: 1 }} />
            </>
          )}
          {!hero && <div style={{ position: 'absolute', inset: 0, background: `rgba(${rgb},.85)` }} />}

          <div className="w" style={{ position: 'relative', zIndex: 10 }}>
            <FadeUp>
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div className="sans" style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 14 }}>Datos de contacto</div>
                <p className="serif" style={{ fontSize: 'clamp(30px,5vw,58px)', fontWeight: 300, fontStyle: 'italic', color: '#fff', lineHeight: 1.15, marginBottom: 20 }}>
                  Estamos aquí para ayudaros
                </p>
                <p className="sans" style={{ fontSize: 14, color: 'rgba(255,255,255,.55)' }}>Estamos a vuestra disposición para resolver lo que necesitéis.</p>
              </div>
            </FadeUp>
            <FadeUp delay={.12}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {contact.phone && (
                  <a href={`https://wa.me/${contact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, he visto la propuesta para ${couple_name}.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 36px', border: '1.5px solid rgba(37,211,102,.5)', color: '#25D366', background: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Inter,sans-serif' }}>
                    <IcoChat width={14} height={14} /> WhatsApp
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Propuesta ${couple_name}`)}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 36px', border: '1.5px solid rgba(255,255,255,.5)', color: '#fff', background: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Inter,sans-serif' }}>
                    Enviar email
                  </a>
                )}
              </div>
            </FadeUp>
          </div>
        </section>
      )}

      {/* ── FLOATING WHATSAPP ── */}
      {contactOn && <FloatingWhatsApp phone={contact.phone} coupleName={couple_name} primary={primary} onPrimary={onPri} />}

      {/* Footer */}
      <footer style={{ background: '#1a0e08', padding: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          {logo && <img src={logo} alt="" style={{ height: 24, objectFit: 'contain', opacity: .7, display: 'block', marginBottom: 10 }} />}
          {venue?.name && <div className="serif" style={{ fontSize: 18, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>{venue.name}</div>}
        </div>
        <div className="sans" style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>
          <a href="https://weddingvenuesspain.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>Wedding Venues Spain</a>
        </div>
      </footer>
    </div>
  )
}
