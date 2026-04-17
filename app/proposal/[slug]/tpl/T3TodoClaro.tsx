'use client'
// Template 3 — 📋 Todo Claro
// Visual: Sidebar sticky con números de sección. Diseño profesional como un brochure premium.
// Sections: Hero + sidebar nav, Experience, Inclusions, Packages, Extras, FAQ, CTA

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { buildSingleFontUrl } from '@/lib/fonts'
import { formatDate, formatPrice, isDark, toRgb, FadeUp, extractData, ConversionBlock, FloatingWhatsApp, AvailabilityBanner, Gallery, IcoPin, IcoCalendar, IcoUsers, IcoChat, type ProposalData } from './shared'

const SECTIONS_DEF = [
  { id: 'experience', label: 'La experiencia', n: '01' },
  { id: 'inclusions', label: 'Qué incluye',    n: '02' },
  { id: 'packages',   label: 'Precios',         n: '03' },
  { id: 'extras',     label: 'Servicios extra', n: '04' },
  { id: 'faq',        label: 'Preguntas',       n: '05' },
  { id: 'contact',    label: 'Contacto',        n: '06' },
]

export default function T3TodoClaro({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date, price_estimate, show_price_estimate, ctas, venue, branding } = data
  const { sec, on, packagesShow, inclusionsShow, extrasShow, faqShow, expShow, menuShow, zonesShow, testsShow } = extractData(data)

  const primary = branding?.primary_color ?? '#1A3A5C'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#fff' : '#111'
  const logo    = branding?.logo_url ?? null
  const font    = (branding as any)?.font_family || 'Cormorant Garamond,Georgia,serif'

  const [heroLoaded, setHeroLoaded] = useState(false)
  const [ctaF, setCtaF] = useState({ name:'', email:'', phone:'', message:'' })
  const [ctaSent, setCtaSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [openFaq, setOpenFaq] = useState<number|null>(null)
  const [activeSection, setActiveSection] = useState('')
  const sectionRefs = useRef<Record<string, HTMLElement|null>>({})

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
      const scrollY = window.scrollY + 160
      let current = ''
      SECTIONS_DEF.forEach(({ id }) => {
        const el = sectionRefs.current[id]
        if (el && el.offsetTop <= scrollY) current = id
      })
      setActiveSection(current)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id: string) => {
    const el = sectionRefs.current[id]
    if (el) window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' })
  }

  const submitCta = async (type: string) => {
    if (!ctaF.name || !ctaF.email) return; setSending(true)
    await createClient().from('proposal_cta_requests').insert({ proposal_id: data.id, type, name: ctaF.name, email: ctaF.email, phone: ctaF.phone||null, message: ctaF.message||null })
    setCtaSent(true); setSending(false)
  }

  const wDate   = formatDate(wedding_date)
  const photos  = venue?.photo_urls ?? []
  const hero    = sec.hero_image_url ?? photos[0] ?? null
  const gallery = sec.gallery_urls?.length ? sec.gallery_urls.slice(0, 4) : photos.slice(1, 4)
  const showCtas = Array.isArray(ctas) && ctas.length > 0
  const pkgs    = packagesShow.filter((p:any) => p.is_active !== false)

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth}body{-webkit-font-smoothing:antialiased}
    ::selection{background:rgba(${rgb},.15)}
    /* Layout */
    .main-layout{display:grid;grid-template-columns:240px 1fr;min-height:100vh;max-width:1100px;margin:0 auto;padding:0 40px}
    .sidebar{position:sticky;top:80px;padding:60px 40px 60px 0;align-self:start;height:fit-content}
    .content{padding:60px 0 60px 48px;border-left:1px solid #E8E4DF}
    .sec{padding:72px 0;border-bottom:1px solid #F0EDE9}
    .sec:last-child{border-bottom:none}
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
    /* Sidebar nav item */
    .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;
      border-radius:8px;cursor:pointer;transition:background .15s;border:none;background:none;
      width:100%;text-align:left;font-family:Inter,sans-serif}
    .nav-item:hover{background:rgba(${rgb},.07)}
    .nav-item.active{background:rgba(${rgb},.1)}
    @media(max-width:780px){.main-layout{grid-template-columns:1fr;padding:0 20px}.sidebar{display:none}.content{padding:20px 0;border-left:none}}
  `

  return (
    <div style={{ fontFamily: 'Inter,system-ui,sans-serif', background: '#F8F6F3', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ══════════════════════════════════════════
          HERO — informational, clean
      ══════════════════════════════════════════ */}
      <section style={{ position: 'relative', height: '56vh', minHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {hero ? (
          <>
            <img src={hero} alt="" onLoad={() => setHeroLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, transition: 'opacity 1.4s', opacity: heroLoaded ? 1 : 0 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,.7) 100%)', zIndex: 1 }} />
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
      {sec.show_availability_msg && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} />
      )}

      {/* ── CONVERSION BLOCK ── */}
      <ConversionBlock data={data} primary={primary} onPrimary={onPri} dark={false} ctaId="cta" />

      {/* ══════════════════════════════════════════
          MAIN LAYOUT — sidebar + content
      ══════════════════════════════════════════ */}
      <div className="main-layout">

        {/* ── Sidebar navigation ────────────────── */}
        <aside className="sidebar">
          <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: '#C8C3BE', marginBottom: 24 }}>Contenido</div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SECTIONS_DEF.map(({ id, label, n }) => (
              <button key={id} className={`nav-item${activeSection === id ? ' active' : ''}`} onClick={() => scrollTo(id)}>
                <span style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#C8C3BE', minWidth: 20 }}>{n}</span>
                <span style={{ fontSize: 13, color: activeSection === id ? primary : '#5a5550', fontWeight: activeSection === id ? 600 : 400 }}>{label}</span>
                {activeSection === id && <div style={{ marginLeft: 'auto', width: 4, height: 4, borderRadius: '50%', background: primary }} />}
              </button>
            ))}
          </nav>

          {/* Key info box */}
          <div style={{ marginTop: 40, padding: '20px', background: '#fff', borderRadius: 12, border: '1px solid #EDEAE6' }}>
            {show_price_estimate && price_estimate && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#C8C3BE', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 4 }}>Estimación</div>
                <div style={{ fontFamily: font, fontSize: 28, fontWeight: 300, color: primary, lineHeight: 1 }}>{formatPrice(price_estimate)}</div>
              </div>
            )}
            {guest_count && (
              <div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, color: '#C8C3BE', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 4 }}>Invitados</div>
                <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 16, fontWeight: 600, color: '#2a2420' }}>{guest_count}</div>
              </div>
            )}
          </div>

          {showCtas && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-pri" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                onClick={() => scrollTo('contact')}>
                Solicitar visita →
              </button>
            </div>
          )}
        </aside>


        {/* ── Main content ─────────────────────── */}
        <main className="content">

          {/* 01 — Experience */}
          {on('experience') && expShow && (expShow as any).body && (
            <div className="sec" ref={el => { sectionRefs.current['experience'] = el }} id="exp-section">
              <FadeUp>
                <div className="sec-n">01 — La experiencia</div>
                <h2 className="sec-h">{(expShow as any).title || 'Vuestro día especial'}</h2>
                <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: '#64605C', lineHeight: 1.9, maxWidth: 560 }}>{(expShow as any).body}</p>
              </FadeUp>
              {personal_message && (
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

          {/* 02 — Inclusions */}
          {on('inclusions') && inclusionsShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['inclusions'] = el }}>
              <FadeUp>
                <div className="sec-n">02 — Qué incluye</div>
                <h2 className="sec-h">Todo incluido</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 0 }} className="two-col">
                {inclusionsShow.map((inc:any, i:number) => (
                  <FadeUp key={i} delay={(i%2)*.05}>
                    <div className="inc-row">
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{inc.emoji||'✓'}</span>
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

          {/* 03 — Packages */}
          {on('packages') && pkgs.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['packages'] = el }}>
              <FadeUp>
                <div className="sec-n">03 — Paquetes y precios</div>
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

          {/* Menu prices */}
          {on('menu_prices') && menuShow.length > 0 && (
            <div className="sec">
              <FadeUp>
                <div className="sec-n">— Gastronomía</div>
                <h2 className="sec-h">Catering y menú</h2>
              </FadeUp>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                {menuShow.map((mp:any, i:number) => (
                  <FadeUp key={i} delay={i*.06}>
                    <div style={{ background: '#fff', border: '1px solid #EDEAE6', borderRadius: 12, padding: '20px 22px' }}>
                      <div style={{ fontFamily: font, fontSize: 20, fontWeight: 400, color: '#181410', marginBottom: 8 }}>{mp.name}</div>
                      {mp.description && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 12, color: '#9a9590', lineHeight: 1.6, marginBottom: 14 }}>{mp.description}</p>}
                      <div style={{ fontFamily: font, fontSize: 28, fontWeight: 300, color: primary }}>{mp.price_per_person}<span style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: '#C0BAB5' }}> /pax</span></div>
                    </div>
                  </FadeUp>
                ))}
              </div>
            </div>
          )}

          {/* 04 — Extra services */}
          {on('extra_services') && extrasShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['extras'] = el }}>
              <FadeUp>
                <div className="sec-n">04 — Servicios adicionales</div>
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

          {/* 05 — FAQ */}
          {on('faq') && faqShow.length > 0 && (
            <div className="sec" ref={el => { sectionRefs.current['faq'] = el }}>
              <FadeUp>
                <div className="sec-n">05 — Dudas frecuentes</div>
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

          {/* Map */}
          {on('map') && (data.venueContent.map_info as any)?.embed_url && (
            <div className="sec">
              <FadeUp>
                <div className="sec-n">— Ubicación</div>
                <h2 className="sec-h">Cómo llegar</h2>
              </FadeUp>
              <FadeUp delay={.1}>
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #EDEAE6' }}>
                  <iframe src={(data.venueContent.map_info as any).embed_url} width="100%" height="300" style={{ border: 'none', display: 'block' }} loading="lazy" allowFullScreen />
                </div>
              </FadeUp>
            </div>
          )}

          {/* 06 — Contact */}
          {showCtas && (
            <div className="sec" ref={el => { sectionRefs.current['contact'] = el }} id="cta">
              <FadeUp>
                <div className="sec-n">06 — Contacto</div>
                <h2 className="sec-h">Reservad vuestra visita</h2>
              </FadeUp>
              {!ctaSent ? (
                <FadeUp delay={.1}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 14 }} className="two-col">
                    {[{k:'name',label:'Nombre *',ph:'Vuestro nombre',type:'text'},{k:'email',label:'Email *',ph:'email@ejemplo.com',type:'email'},{k:'phone',label:'Teléfono',ph:'+34 600 000 000',type:'tel'},{k:'message',label:'Mensaje',ph:'Alguna pregunta...',type:'text'}].map(f=>(
                      <div key={f.k}>
                        <label className="flabel">{f.label}</label>
                        <input type={f.type} className="inp" value={(ctaF as any)[f.k]} onChange={e=>setCtaF(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {ctas.includes('visit') && <button className="btn btn-pri" onClick={()=>submitCta('visit')} disabled={sending||!ctaF.name||!ctaF.email} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{sending?'Enviando…':<><IcoCalendar width={13} height={13} /> Solicitar visita</>}</button>}
                    {ctas.includes('budget') && <button className="btn btn-sec" onClick={()=>submitCta('budget')} disabled={sending||!ctaF.name||!ctaF.email}>Pedir presupuesto</button>}
                    {ctas.includes('whatsapp') && venue?.contact_phone && (
                      <a href={`https://wa.me/${venue.contact_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, propuesta para ${couple_name}.`)}`} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: 'none', fontFamily: 'Inter,sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                        <IcoChat width={13} height={13} /> WhatsApp
                      </a>
                    )}
                  </div>
                </FadeUp>
              ) : (
                <div style={{ padding: '40px 0' }}>
                  <h3 style={{ fontFamily: font, fontSize: 28, fontWeight: 400, color: '#181410', marginBottom: 8 }}>¡Recibido!</h3>
                  <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: '#9a9590' }}>Os contactaremos en menos de 24 horas.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── FLOATING WHATSAPP ── */}
      <FloatingWhatsApp phone={venue?.contact_phone || ''} coupleName={couple_name} primary={primary} onPrimary={onPri} />

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
