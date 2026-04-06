'use client'
// Template 2 — ✨ Emoción Primero
// Visual: Calor, luz, editorial. La galería como protagonista. Todo en crema y serif.
// Sections: Hero minimal, Gallery (full-bleed), Mensaje personal, Experiencia, Testimonios, Incluye, CTA romántico

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { buildSingleFontUrl } from '@/lib/fonts'
import { formatDate, formatPrice, isDark, toRgb, FadeUp, FadeIn, extractData, ConversionBlock, FloatingWhatsApp, AvailabilityBanner, type ProposalData } from './shared'

export default function T2Emocion({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date, price_estimate, show_price_estimate, ctas, venue, branding } = data
  const { sec, on, packagesShow, inclusionsShow, testsShow, extrasShow, expShow, faqShow } = extractData(data)

  const primary = branding?.primary_color ?? '#6B4F3A'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#fff' : '#111'
  const logo    = branding?.logo_url ?? null
  const font    = (branding as any)?.font_family || 'Cormorant Garamond,Georgia,serif'

  const [heroLoaded, setHeroLoaded] = useState(false)
  const [ctaF, setCtaF]   = useState({ name:'', email:'', phone:'', message:'' })
  const [ctaSent, setCtaSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [openFaq, setOpenFaq] = useState<number|null>(null)

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

  const submitCta = async (type: string) => {
    if (!ctaF.name || !ctaF.email) return; setSending(true)
    await createClient().from('proposal_cta_requests').insert({ proposal_id: data.id, type, name: ctaF.name, email: ctaF.email, phone: ctaF.phone||null, message: ctaF.message||null })
    setCtaSent(true); setSending(false)
  }

  const wDate   = formatDate(wedding_date)
  const photos  = venue?.photo_urls ?? []
  const hero    = photos[0] ?? null
  const gallery = photos.slice(1, 7)
  const showCtas = Array.isArray(ctas) && ctas.length > 0
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
  `

  return (
    <div style={{ fontFamily: font, background: CREAM, color: '#2c2418', minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ══════════════════════════════════════════
          HERO — minimal, image is everything
      ══════════════════════════════════════════ */}
      <section style={{ position: 'relative', height: '100svh', minHeight: 560, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {hero ? (
          <>
            <img src={hero} alt="" onLoad={() => setHeroLoaded(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 25%', zIndex: 0, transition: 'opacity 1.8s ease', opacity: heroLoaded ? 1 : 0 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,14,8,.38)', zIndex: 1 }} />
            {/* Vignette */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,.35) 100%)', zIndex: 2 }} />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: '#1a0e08' }} />
        )}

        {/* Centered content */}
        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '0 24px' }}>
          {logo && <div className="hc1" style={{ marginBottom: 32 }}><img src={logo} alt="" style={{ height: 32, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: .65 }} /></div>}
          <div className="hc1 sans" style={{ fontSize: 10, letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 20 }}>
            Una propuesta especial para
          </div>
          <h1 className="hc2 serif" style={{ fontSize: 'clamp(52px,9vw,96px)', fontWeight: 300, color: '#fff', lineHeight: 1.0, letterSpacing: '-.01em', marginBottom: 28, fontStyle: 'italic' }}>
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
      {sec.show_availability_msg && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} />
      )}

      {/* ══════════════════════════════════════════
          GALLERY — full-bleed, immediately
      ══════════════════════════════════════════ */}
      {on('gallery') && gallery.length > 0 && (
        <section>
          <FadeIn>
            {gallery.length === 1 && (
              <div className="gcell" style={{ height: 600, overflow: 'hidden' }}><img src={gallery[0]} alt="" className="gimg" /></div>
            )}
            {gallery.length >= 2 && (
              <>
                {/* Main row */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', height: 520 }}>
                  <div className="gcell" style={{ overflow: 'hidden' }}><img src={gallery[0]} alt="" className="gimg" /></div>
                  <div style={{ display: 'grid', gridTemplateRows: gallery[2]?'1fr 1fr':'1fr' }}>
                    <div className="gcell" style={{ overflow: 'hidden', borderLeft: `2px solid ${CREAM}` }}><img src={gallery[1]} alt="" className="gimg" /></div>
                    {gallery[2] && <div className="gcell" style={{ overflow: 'hidden', borderLeft: `2px solid ${CREAM}`, borderTop: `2px solid ${CREAM}` }}><img src={gallery[2]} alt="" className="gimg" /></div>}
                  </div>
                </div>
                {/* Secondary row */}
                {gallery.length > 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(gallery.length-3,3)},1fr)`, height: 300, borderTop: `2px solid ${CREAM}` }}>
                    {gallery.slice(3,6).map((url,i) => (
                      <div key={i} className="gcell" style={{ overflow: 'hidden', borderLeft: i>0?`2px solid ${CREAM}`:'none' }}>
                        <img src={url} alt="" className="gimg" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </FadeIn>
        </section>
      )}


      {/* ══════════════════════════════════════════
          PERSONAL MESSAGE — editorial quote
      ══════════════════════════════════════════ */}
      {personal_message && (
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


      {/* ── CONVERSION BLOCK ── */}
      <FadeIn>
        <ConversionBlock data={data} primary={primary} onPrimary={onPri} dark={false} ctaId="cta" />
      </FadeIn>

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
                    <div style={{ color: '#C9A96E', fontSize: 16, letterSpacing: 4, marginBottom: 20 }}>{'★'.repeat(t.rating??5)}</div>
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
                    <div style={{ fontSize: 32, marginBottom: 14 }}>{inc.emoji || '✦'}</div>
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
          CTA — romantic, soft
      ══════════════════════════════════════════ */}
      {showCtas && (
        <section id="cta" style={{ position: 'relative', padding: '120px 0', overflow: 'hidden' }}>
          {hero && (
            <>
              <img src={hero} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, filter: 'brightness(.3) saturate(.5)' }} />
              <div style={{ position: 'absolute', inset: 0, background: `rgba(${toRgb('#2c1a0e')},.7)`, zIndex: 1 }} />
            </>
          )}
          {!hero && <div style={{ position: 'absolute', inset: 0, background: `rgba(${rgb},.85)` }} />}

          <div className="w" style={{ position: 'relative', zIndex: 10 }}>
            {!ctaSent ? (
              <>
                <FadeUp>
                  <div style={{ textAlign: 'center', marginBottom: 64 }}>
                    <p className="serif" style={{ fontSize: 'clamp(30px,5vw,58px)', fontWeight: 300, fontStyle: 'italic', color: '#fff', lineHeight: 1.15, marginBottom: 20 }}>
                      ¿Comenzamos a planear vuestro día?
                    </p>
                    <p className="sans" style={{ fontSize: 14, color: 'rgba(255,255,255,.5)' }}>Dejadnos vuestros datos y os contactamos pronto.</p>
                  </div>
                </FadeUp>
                <FadeUp delay={.12}>
                  <div style={{ maxWidth: 520, margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }} className="two-col">
                      {[{k:'name',ph:'Vuestro nombre'},{k:'email',ph:'Correo electrónico'},{k:'phone',ph:'Teléfono'},{k:'message',ph:'Un mensaje...'}].map(f=>(
                        <div key={f.k}><input className="inp" value={(ctaF as any)[f.k]} onChange={e=>setCtaF(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} /></div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
                      {ctas.includes('visit') && (
                        <button className="btn-em" style={{ borderColor: 'rgba(255,255,255,.5)', color: '#fff' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='' }}
                          onClick={()=>submitCta('visit')} disabled={sending||!ctaF.name||!ctaF.email}>
                          {sending?'Enviando…':'Solicitar visita'}
                        </button>
                      )}
                      {ctas.includes('whatsapp') && venue?.contact_phone && (
                        <a href={`https://wa.me/${venue.contact_phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, me ha llegado la propuesta para ${couple_name}.`)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 36px', border: '1.5px solid rgba(37,211,102,.5)', color: '#25D366', background: 'none', fontSize: 12, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: 'Inter,sans-serif' }}>
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </FadeUp>
              </>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p className="serif" style={{ fontSize: 48, fontWeight: 300, fontStyle: 'italic', color: '#fff', marginBottom: 16 }}>¡Perfecto!</p>
                <p className="sans" style={{ fontSize: 15, color: 'rgba(255,255,255,.5)' }}>Os contactaremos muy pronto.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FLOATING WHATSAPP ── */}
      <FloatingWhatsApp phone={venue?.contact_phone || ''} coupleName={couple_name} primary={primary} onPrimary={onPri} />

      {/* Footer */}
      <footer style={{ background: '#1a0e08', padding: '48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          {logo && <img src={logo} alt="" style={{ height: 24, objectFit: 'contain', filter: 'brightness(0) invert(.4)', display: 'block', marginBottom: 10 }} />}
          {venue?.name && <div className="serif" style={{ fontSize: 18, color: 'rgba(255,255,255,.3)', fontStyle: 'italic' }}>{venue.name}</div>}
        </div>
        <div className="sans" style={{ fontSize: 11, color: 'rgba(255,255,255,.15)' }}>
          <a href="https://weddingvenuesspain.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,.25)', textDecoration: 'none' }}>Wedding Venues Spain</a>
        </div>
      </footer>
    </div>
  )
}
