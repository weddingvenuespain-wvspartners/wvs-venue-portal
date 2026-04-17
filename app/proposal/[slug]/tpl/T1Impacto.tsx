'use client'
// Template 1 — ⚡ Impacto Directo
// Dark luxury hotel · Conversión inmediata · Venue presentation completo
// Secciones: Hero → Historia → Galería → Espacios → Paquetes → Temporadas
//            → Qué incluye → Testimoniales → Colaboradores → Extras → FAQ → CTA

import { useEffect, useRef, useState } from 'react'
import { formatDate, formatPrice, isDark, toRgb, FadeUp, FadeIn, extractData, ConversionBlock, FloatingWhatsApp, AvailabilityBanner, Gallery, IcoPin, IcoCalendar, IcoUsers, IcoBuilding, type ProposalData } from './shared'

export default function T1Impacto({ data }: { data: ProposalData }) {
  const { couple_name, personal_message, guest_count, wedding_date,
          price_estimate, show_price_estimate, venue, branding } = data
  const { sec, on, packagesShow, inclusionsShow, extrasShow, faqShow,
          testsShow, zonesShow, seasonsShow, collabsShow, menuShow,
          expShow, techspecs, accom } = extractData(data)

  const primary = branding?.primary_color ?? '#8B6914'
  const rgb     = toRgb(primary)
  const onPri   = isDark(primary) ? '#fff' : '#111'
  const logo    = branding?.logo_url ?? null
  const FONT    = "'Cormorant Garamond', Georgia, serif"

  const [scrolled, setScrolled]     = useState(false)
  const [ctaBar, setCtaBar]         = useState(false)
  const [openFaq, setOpenFaq]       = useState<number | null>(null)
  const [ctaF, setCtaF]             = useState({ name: '', email: '', phone: '', message: '' })
  const [ctaSent, setCtaSent]       = useState(false)
  const [sending, setSending]       = useState(false)
  const heroRef                     = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY
      setScrolled(y > 60)
      setCtaBar(y > window.innerHeight * 0.6)
      if (heroRef.current) heroRef.current.style.transform = `translateY(${y * 0.22}px)`
    }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ctaF.name || !ctaF.email) return
    setSending(true)
    try {
      const { createClient } = await import('@/lib/supabase')
      await createClient().from('proposal_contacts').insert({ proposal_id: data.id, ...ctaF })
    } catch {}
    setCtaSent(true)
    setSending(false)
  }

  const photos       = venue?.photo_urls ?? []
  const hero         = sec.hero_image_url ?? photos[0] ?? ''
  const galleryPhotos = sec.gallery_urls?.length ? sec.gallery_urls : photos.slice(2, 7)
  const pkgs    = packagesShow.filter((p: any) => p.is_active !== false)
  const wDate   = formatDate(wedding_date)

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600;700&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html{scroll-behavior:smooth} body{-webkit-font-smoothing:antialiased}
    ::selection{background:rgba(${rgb},.25)}

    .t1{font-family:'Inter',system-ui,sans-serif;background:#0a0a0a;color:#fff;overflow-x:hidden}

    /* Layout helpers */
    .w{max-width:1100px;margin:0 auto;padding:0 48px}
    .w-sm{max-width:760px;margin:0 auto;padding:0 48px}

    /* ── Sticky nav ── */
    .t1-nav{
      position:fixed;top:0;left:0;right:0;z-index:200;
      display:flex;align-items:center;justify-content:space-between;
      padding:0 48px;height:64px;
      background:rgba(10,10,10,0);
      transition:background .4s,box-shadow .4s;
    }
    .t1-nav.scrolled{background:rgba(10,10,10,.97);box-shadow:0 1px 0 rgba(255,255,255,.06)}
    .t1-nav-logo{font-family:${FONT};font-size:1rem;font-weight:400;color:rgba(255,255,255,.5);letter-spacing:.04em}
    .t1-nav-cta{
      background:${primary};color:${onPri};border:none;
      padding:9px 22px;font-size:.72rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
      cursor:pointer;transition:opacity .2s;
    }
    .t1-nav-cta:hover{opacity:.85}

    /* ── Sticky bottom bar ── */
    .t1-sbar{
      position:fixed;bottom:0;left:0;right:0;z-index:200;
      background:${primary};color:${onPri};
      display:flex;align-items:center;justify-content:space-between;
      padding:14px 48px;
      box-shadow:0 -6px 32px rgba(${rgb},.5);
      transform:translateY(${ctaBar ? '0' : '100%'});
      transition:transform .4s cubic-bezier(.22,1,.36,1);
    }

    /* ── Hero ── */
    .t1-hero{position:relative;height:100svh;min-height:620px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
    .t1-hero-img{position:absolute;inset:0;width:100%;height:120%;object-fit:cover;object-position:center 20%;transform-origin:center top}
    .t1-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,.15) 0%,rgba(0,0,0,.0) 30%,rgba(0,0,0,.7) 72%,rgba(0,0,0,.98) 100%)}
    @keyframes zoom{from{transform:scale(1.06) translateY(0)}to{transform:scale(1.0) translateY(0)}}
    @keyframes hf{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
    .ha{animation:hf .9s ease both}

    /* ── Stats bar ── */
    .t1-stats{display:flex;background:#111;border-bottom:1px solid #1e1e1e}
    .t1-stat{flex:1;padding:28px 24px;border-right:1px solid #1e1e1e;text-align:center}
    .t1-stat:last-child{border-right:none}
    .t1-stat-n{font-family:${FONT};font-size:2.2rem;font-weight:300;color:${primary};line-height:1;display:block}
    .t1-stat-l{font-size:.62rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:6px;display:block}

    /* ── Sections base ── */
    .t1-sec{padding:96px 0;border-top:1px solid #181818}
    .t1-label{font-size:.62rem;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:12px;display:block}
    .t1-h2{font-family:${FONT};font-size:clamp(2rem,3.8vw,3.4rem);font-weight:300;color:#fff;line-height:1.08;margin-bottom:56px}
    .t1-line{width:36px;height:1.5px;background:${primary};margin:18px 0 40px}

    /* ── Story section ── */
    .t1-story{display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:stretch}
    .t1-story-text{padding:80px 64px;background:#0e0e0e}
    .t1-story-body{font-size:.97rem;color:rgba(255,255,255,.5);line-height:1.9;white-space:pre-wrap;margin-top:4px}
    .t1-story-img{overflow:hidden;min-height:500px;position:relative}
    .t1-story-img img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.8);transition:transform .8s ease}
    .t1-story-img:hover img{transform:scale(1.04)}

    /* ── Gallery mosaic ── */
    .t1-mosaic{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:340px 260px;gap:3px;background:#000}
    .t1-mosaic-item{overflow:hidden;position:relative}
    .t1-mosaic-item img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.75);transition:transform .7s ease,filter .4s}
    .t1-mosaic-item:hover img{transform:scale(1.05);filter:brightness(.95)}
    .t1-mosaic-item.span-2{grid-row:span 2}

    /* ── Zones / Spaces ── */
    .t1-zones{display:flex;flex-direction:column;gap:2px}
    .t1-zone{display:grid;grid-template-columns:1fr 1fr;background:#111;overflow:hidden}
    .t1-zone:nth-child(even) .t1-zone-img{order:2}
    .t1-zone:nth-child(even) .t1-zone-info{order:1}
    .t1-zone-img{overflow:hidden;min-height:320px}
    .t1-zone-img img{width:100%;height:100%;object-fit:cover;display:block;filter:brightness(.8);transition:transform .7s ease,filter .4s}
    .t1-zone:hover .t1-zone-img img{transform:scale(1.04);filter:brightness(.95)}
    .t1-zone-ph{width:100%;height:100%;min-height:320px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:3rem;opacity:.3}
    .t1-zone-info{padding:52px 48px;display:flex;flex-direction:column;gap:12px}
    .t1-zone-name{font-family:${FONT};font-size:1.9rem;font-weight:300;color:#fff}
    .t1-zone-desc{font-size:.88rem;color:rgba(255,255,255,.45);line-height:1.85}
    .t1-zone-cap{font-size:.78rem;font-weight:600;letter-spacing:.06em;color:${primary};text-transform:uppercase}
    .t1-zone-price{font-size:.85rem;color:rgba(255,255,255,.3)}

    /* ── Packages ── */
    .t1-pkgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:2px}
    .t1-pkg{background:#111;padding:40px 36px;display:flex;flex-direction:column;transition:background .25s}
    .t1-pkg:hover{background:#151515}
    .t1-pkg.rec{border-top:2px solid ${primary}}
    .t1-pkg-badge{font-size:.58rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${primary};margin-bottom:14px}
    .t1-pkg-name{font-family:${FONT};font-size:1.7rem;font-weight:300;color:#fff;margin-bottom:4px}
    .t1-pkg-sub{font-size:.78rem;color:rgba(255,255,255,.3);margin-bottom:20px}
    .t1-pkg-price{font-family:${FONT};font-size:clamp(2.8rem,5vw,4.2rem);font-weight:300;color:${primary};line-height:1;margin:8px 0 28px}
    .t1-pkg-price small{font-size:1rem;color:rgba(255,255,255,.3);font-family:'Inter',sans-serif;font-weight:300}
    .t1-pkg-includes{list-style:none;display:flex;flex-direction:column;gap:9px;flex:1}
    .t1-pkg-includes li{font-size:.82rem;color:rgba(255,255,255,.5);display:flex;align-items:baseline;gap:9px}
    .t1-pkg-includes li::before{content:'✦';color:${primary};font-size:.5rem;flex-shrink:0}
    .t1-pkg-guests{margin-top:20px;padding-top:18px;border-top:1px solid #222;font-size:.75rem;color:rgba(255,255,255,.22)}

    /* ── Season pricing ── */
    .t1-seasons{display:flex;flex-direction:column;gap:2px}
    .t1-season{display:grid;grid-template-columns:1fr 2fr 1fr;align-items:center;padding:22px 32px;background:#111;gap:24px;transition:background .2s}
    .t1-season:hover{background:#141414}
    .t1-season.alta{border-left:2px solid ${primary}}
    .t1-season-lbl{font-family:${FONT};font-size:1.1rem;font-weight:400;color:#fff}
    .t1-season-dates{font-size:.82rem;color:rgba(255,255,255,.38);line-height:1.6}
    .t1-season-price{font-family:${FONT};font-size:1.3rem;font-weight:300;color:${primary};text-align:right}

    /* ── Inclusions ── */
    .t1-inc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0}
    .t1-inc{display:flex;align-items:flex-start;gap:14px;padding:20px 0;border-bottom:1px solid #181818}
    .t1-inc-emoji{font-size:1.4rem;flex-shrink:0;opacity:.85;margin-top:1px}
    .t1-inc-title{font-size:.9rem;font-weight:500;color:rgba(255,255,255,.82);margin-bottom:3px}
    .t1-inc-desc{font-size:.78rem;color:rgba(255,255,255,.35);line-height:1.55}

    /* ── Menu ── */
    .t1-menu-row{display:flex;align-items:center;justify-content:space-between;padding:20px 0;border-bottom:1px solid #181818;gap:20px}
    .t1-menu-name{font-family:${FONT};font-size:1.2rem;font-weight:400;color:#fff}
    .t1-menu-desc{font-size:.8rem;color:rgba(255,255,255,.38);margin-top:3px;line-height:1.5}
    .t1-menu-price{font-family:${FONT};font-size:1.6rem;font-weight:300;color:${primary};white-space:nowrap}

    /* ── Testimonials ── */
    .t1-tests{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:2px}
    .t1-test{background:#111;padding:44px 40px;display:flex;flex-direction:column;gap:20px;position:relative;overflow:hidden}
    .t1-test-qmark{position:absolute;top:-10px;left:24px;font-family:${FONT};font-size:10rem;color:${primary};opacity:.08;line-height:1;user-select:none}
    .t1-test-stars{color:#F5A623;font-size:.85rem;letter-spacing:2px}
    .t1-test-text{font-family:${FONT};font-style:italic;font-size:1.05rem;line-height:1.85;color:rgba(255,255,255,.7);position:relative;z-index:1}
    .t1-test-foot{display:flex;align-items:center;gap:14px;padding-top:16px;border-top:1px solid #1e1e1e}
    .t1-test-av{width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0;background:#222;border:1px solid #333}
    .t1-test-av img{width:100%;height:100%;object-fit:cover}
    .t1-test-av-ph{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,${primary},rgba(${rgb},.4));display:flex;align-items:center;justify-content:center;font-family:${FONT};font-size:1rem;color:#fff;flex-shrink:0}
    .t1-test-couple{font-size:.85rem;font-weight:600;color:rgba(255,255,255,.7)}
    .t1-test-date{font-size:.73rem;color:rgba(255,255,255,.28);margin-top:1px}

    /* ── Collaborators ── */
    .t1-collabs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1px;background:#1a1a1a}
    .t1-collab{background:#0e0e0e;padding:28px 28px;border-bottom:none}
    .t1-collab-cat{font-size:.6rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${primary};margin-bottom:8px}
    .t1-collab-name{font-size:.95rem;font-weight:600;color:rgba(255,255,255,.8);margin-bottom:4px}
    .t1-collab-desc{font-size:.77rem;color:rgba(255,255,255,.3);line-height:1.55}

    /* ── Extra services ── */
    .t1-extra-row{display:flex;justify-content:space-between;align-items:center;padding:18px 0;border-bottom:1px solid #181818;gap:24px}
    .t1-extra-name{font-size:.93rem;font-weight:500;color:rgba(255,255,255,.8)}
    .t1-extra-desc{font-size:.78rem;color:rgba(255,255,255,.32);margin-top:3px;line-height:1.5}
    .t1-extra-price{font-family:${FONT};font-size:1.4rem;font-weight:300;color:${primary};white-space:nowrap}

    /* ── Message ── */
    .t1-msg{max-width:640px;margin:0 auto;text-align:center;padding:80px 48px}
    .t1-msg-qmark{font-family:${FONT};font-size:8rem;font-weight:300;color:${primary};opacity:.15;line-height:.8;margin-bottom:-10px}
    .t1-msg-text{font-family:${FONT};font-size:clamp(1.1rem,2.2vw,1.45rem);font-style:italic;font-weight:300;color:rgba(255,255,255,.65);line-height:1.85;white-space:pre-wrap}
    .t1-msg-sig{margin-top:28px;font-size:.68rem;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.2)}

    /* ── FAQ ── */
    .t1-faq-item{border-bottom:1px solid #181818}
    .t1-faq-q{width:100%;display:flex;justify-content:space-between;align-items:center;padding:20px 0;background:none;border:none;cursor:pointer;text-align:left;gap:20px}
    .t1-faq-q-text{font-size:.95rem;font-weight:500;color:rgba(255,255,255,.75)}
    .t1-faq-q.open .t1-faq-q-text{color:${primary}}
    .t1-faq-plus{font-size:1.4rem;font-weight:200;color:${primary};flex-shrink:0;transition:transform .25s}
    .t1-faq-a{overflow:hidden;transition:max-height .4s cubic-bezier(.22,1,.36,1)}
    .t1-faq-a-inner{font-size:.87rem;color:rgba(255,255,255,.42);line-height:1.85;padding-bottom:20px}

    /* ── Accommodation ── */
    .t1-accom{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start}
    .t1-accom-rooms-list{display:flex;flex-direction:column;gap:10px;margin-top:8px}
    .t1-accom-room{display:flex;align-items:center;gap:12px;font-size:.88rem;color:rgba(255,255,255,.5)}
    .t1-accom-room::before{content:'';width:6px;height:6px;border-radius:50%;background:${primary};flex-shrink:0}

    /* ── CTA section ── */
    .t1-cta{background:#0d0d0d;padding:100px 0;border-top:2px solid ${primary}}
    .t1-cta-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:start}
    .t1-cta-h{font-family:${FONT};font-size:clamp(2rem,4.5vw,3.6rem);font-weight:300;color:#fff;line-height:1.1;margin-bottom:20px}
    .t1-cta-sub{font-size:.9rem;color:rgba(255,255,255,.38);line-height:1.85;margin-bottom:32px}
    .t1-cta-contact div{font-size:.83rem;color:rgba(255,255,255,.3);margin-bottom:8px}
    .t1-form{display:flex;flex-direction:column;gap:20px}
    .t1-field-label{display:block;font-size:.62rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.28);margin-bottom:9px}
    .t1-input{width:100%;padding:13px 0;border:none;border-bottom:1px solid #282828;background:transparent;font-family:'Inter',sans-serif;font-size:.9rem;color:#fff;outline:none;transition:border-color .2s}
    .t1-input:focus{border-bottom-color:${primary}}
    .t1-input::placeholder{color:rgba(255,255,255,.22)}
    .t1-btn{background:${primary};color:${onPri};border:none;padding:16px 40px;font-size:.78rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:opacity .2s,transform .2s;align-self:flex-start;margin-top:4px}
    .t1-btn:hover{opacity:.88;transform:translateX(3px)}
    .t1-btn:disabled{opacity:.4;cursor:default;transform:none}

    /* ── Footer ── */
    .t1-footer{background:#000;padding:36px 48px;border-top:1px solid #181818;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
    .t1-footer-links{display:flex;gap:20px}
    .t1-footer-links a{font-size:.75rem;color:rgba(255,255,255,.25);text-decoration:none;transition:color .2s}
    .t1-footer-links a:hover{color:rgba(255,255,255,.5)}

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
      .t1-mosaic{grid-template-columns:1fr 1fr;grid-template-rows:auto}
      .t1-mosaic-item.span-2{grid-row:span 1}
    }
    @media(max-width:560px){
      .t1-stats{flex-wrap:wrap}
      .t1-stat{width:50%;border-right:1px solid #1e1e1e}
      .t1-tests{grid-template-columns:1fr}
      .t1-pkgs{grid-template-columns:1fr}
    }
  `

  return (
    <div className="t1">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* ── NAV ── */}
      <nav className={`t1-nav ${scrolled ? 'scrolled' : ''}`}>
        {logo
          ? <img src={logo} alt={venue?.name || ''} style={{ height: 28, objectFit: 'contain' }} />
          : <span className="t1-nav-logo">{venue?.name}</span>
        }
        <button className="t1-nav-cta" onClick={() => document.getElementById('t1-cta')?.scrollIntoView({ behavior: 'smooth' })}>
          Ver disponibilidad
        </button>
      </nav>

      {/* ── STICKY BAR ── */}
      <div className="t1-sbar">
        <div>
          <div style={{ fontFamily: FONT, fontSize: '1.1rem', fontWeight: 300, fontStyle: 'italic' }}>{couple_name}</div>
          <div style={{ fontSize: '.62rem', letterSpacing: '.14em', textTransform: 'uppercase', opacity: .6, marginTop: 2 }}>Propuesta exclusiva · {venue?.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {show_price_estimate && price_estimate && (
            <span style={{ fontFamily: FONT, fontSize: '1.5rem', fontWeight: 300 }}>{formatPrice(price_estimate)}</span>
          )}
          <button style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)', padding: '9px 20px', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}
            onClick={() => document.getElementById('t1-cta')?.scrollIntoView({ behavior: 'smooth' })}>
            Reservar →
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════ */}
      <section className="t1-hero">
        {hero && (
          <>
            <img ref={heroRef} src={hero} alt="" className="t1-hero-img" style={{ animation: 'zoom 14s ease both' }} />
            <div className="t1-hero-overlay" />
          </>
        )}
        {/* Top bar */}
        <div className="ha" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10, animationDelay: '.1s' }}>
          {logo
            ? <img src={logo} alt="" style={{ height: 26, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.7))' }} />
            : <span style={{ fontSize: '.65rem', letterSpacing: '.26em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)' }}>{venue?.name}</span>
          }
        </div>
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 10, padding: '0 48px 80px' }}>
          <div className="ha" style={{ width: 36, height: 1.5, background: primary, marginBottom: 24, animationDelay: '.15s' }} />
          <div className="ha" style={{ fontSize: '.65rem', letterSpacing: '.26em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 16, animationDelay: '.2s' }}>
            Propuesta exclusiva para
          </div>
          <h1 className="ha" style={{ fontFamily: FONT, fontSize: 'clamp(3.2rem,10vw,8rem)', fontWeight: 300, lineHeight: .95, letterSpacing: '-.02em', marginBottom: 32, animationDelay: '.35s' }}>
            {couple_name}
          </h1>
          <div className="ha" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', animationDelay: '.55s' }}>
            {venue?.city && <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.4)', letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 5 }}><IcoPin width={12} height={12} /> {venue.name}, {venue.city}</span>}
            {wDate && <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5 }}><IcoCalendar width={12} height={12} /> {wDate}</span>}
            {guest_count && <span style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5 }}><IcoUsers width={12} height={12} /> {guest_count} invitados</span>}
            {show_price_estimate && price_estimate && (
              <span style={{ fontFamily: FONT, fontSize: '2rem', fontWeight: 300, color: '#fff', borderLeft: `2px solid ${primary}`, paddingLeft: 20, marginLeft: 4, lineHeight: 1 }}>
                {formatPrice(price_estimate)}
              </span>
            )}
          </div>
        </div>
        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '.55rem', letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>Desliza</span>
          <div style={{ width: 1, height: 40, background: `linear-gradient(to bottom, rgba(255,255,255,.3), transparent)` }} />
        </div>
      </section>

      {/* ── AVAILABILITY BANNER ── */}
      {sec.show_availability_msg && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={onPri} />
      )}

      {/* ── STATS BAR ── */}
      <div className="t1-stats">
        {[
          { n: '1687', l: 'Año de fundación' },
          { n: techspecs?.sqm?.split('·')[0]?.trim() || '8 Ha', l: 'Extensión' },
          { n: '350', l: 'Capacidad máxima' },
          { n: '1', l: 'Sola boda al día' },
        ].map((s, i) => (
          <FadeIn key={i} delay={i * .08}>
            <div className="t1-stat">
              <span className="t1-stat-n">{s.n}</span>
              <span className="t1-stat-l">{s.l}</span>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          MENSAJE PERSONAL + CONVERSION BLOCK
      ════════════════════════════════════════════ */}
      {personal_message && (
        <section className="t1-sec" style={{ background: '#080808' }}>
          <FadeUp>
            <div className="t1-msg">
              <div className="t1-msg-qmark">"</div>
              <p className="t1-msg-text">{personal_message}</p>
              {venue?.name && <div className="t1-msg-sig">— {venue.name}</div>}
            </div>
          </FadeUp>
        </section>
      )}

      {/* ── CONVERSION BLOCK ── */}
      <FadeIn>
        <ConversionBlock data={data} primary={primary} onPrimary={onPri} dark ctaId="t1-cta" />
      </FadeIn>

      {/* ════════════════════════════════════════════
          HISTORIA / EXPERIENCE
      ════════════════════════════════════════════ */}
      {expShow && on('experience') && (
        <section style={{ borderTop: '1px solid #181818' }}>
          <div className="t1-story">
            <FadeUp>
              <div className="t1-story-text">
                <span className="t1-label">Nuestra historia</span>
                <h2 style={{ fontFamily: FONT, fontSize: 'clamp(1.8rem,3vw,2.8rem)', fontWeight: 300, color: '#fff', lineHeight: 1.15, marginBottom: 24 }}>
                  {expShow.title}
                </h2>
                <div className="t1-line" />
                <p className="t1-story-body">{expShow.body}</p>
              </div>
            </FadeUp>
            {(sec.gallery_urls?.[0] ?? photos[1]) && (
              <div className="t1-story-img">
                <img src={sec.gallery_urls?.[0] ?? photos[1]} alt="El espacio" loading="lazy" />
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
      {on('gallery') && galleryPhotos.length > 0 && (
        <FadeIn>
          <Gallery photos={galleryPhotos} primary={primary} dark />
        </FadeIn>
      )}

      {/* ════════════════════════════════════════════
          ESPACIOS / ZONES
      ════════════════════════════════════════════ */}
      {on('zones') && zonesShow.length > 0 && (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">Los espacios</span>
              <h2 className="t1-h2">Cada rincón, un escenario</h2>
            </FadeUp>
          </div>
          <div className="t1-zones">
            {zonesShow.map((z: any, i: number) => {
              const zPhoto = z.photos?.[0] || photos[i + 2]
              return (
                <FadeIn key={i} delay={0.05}>
                  <div className="t1-zone">
                    <div className="t1-zone-img">
                      {zPhoto
                        ? <img src={zPhoto} alt={z.name} loading="lazy" />
                        : <div className="t1-zone-ph"><IcoBuilding width={48} height={48} style={{ opacity: .3, color: '#fff' }} /></div>
                      }
                    </div>
                    <div className="t1-zone-info">
                      <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)' }}>Espacio {String(i + 1).padStart(2, '0')}</div>
                      <div className="t1-zone-name">{z.name}</div>
                      {z.description && <p className="t1-zone-desc">{z.description}</p>}
                      {(z.capacity_min || z.capacity_max) && (
                        <div className="t1-zone-cap">
                          {z.capacity_min && `${z.capacity_min}`}{z.capacity_min && z.capacity_max ? ' – ' : ''}{z.capacity_max && `${z.capacity_max}`} personas
                        </div>
                      )}
                      {z.price && <div className="t1-zone-price">{z.price}</div>}
                    </div>
                  </div>
                </FadeIn>
              )
            })}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          PAQUETES
      ════════════════════════════════════════════ */}
      {on('packages') && pkgs.length > 0 && (
        <section className="t1-sec" style={{ background: '#050505' }}>
          <div className="w">
            <FadeUp>
              <span className="t1-label">Paquetes y precios</span>
              <h2 className="t1-h2">Elige tu propuesta</h2>
            </FadeUp>
            <div className="t1-pkgs">
              {pkgs.map((pkg: any, i: number) => (
                <FadeUp key={i} delay={i * .08}>
                  <div className={`t1-pkg${pkg.is_recommended ? ' rec' : ''}`}>
                    {pkg.is_recommended && <div className="t1-pkg-badge">★ Más elegido</div>}
                    <div className="t1-pkg-name">{pkg.name}</div>
                    {pkg.subtitle && <div className="t1-pkg-sub">{pkg.subtitle}</div>}
                    {pkg.price && (
                      <div className="t1-pkg-price">
                        {pkg.price} <small>/ persona</small>
                      </div>
                    )}
                    {pkg.includes?.length > 0 && (
                      <ul className="t1-pkg-includes">
                        {pkg.includes.filter(Boolean).map((inc: string, j: number) => (
                          <li key={j}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    {(pkg.min_guests || pkg.max_guests) && (
                      <div className="t1-pkg-guests">
                        {pkg.min_guests && `Mín. ${pkg.min_guests}`}{pkg.min_guests && pkg.max_guests ? ' · ' : ''}{pkg.max_guests && `Máx. ${pkg.max_guests}`} invitados
                      </div>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>
            <FadeUp delay={.2} style={{ marginTop: 48, textAlign: 'center' }}>
              <button style={{ background: primary, color: onPri, border: 'none', padding: '15px 44px', fontSize: '.78rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}
                onClick={() => document.getElementById('t1-cta')?.scrollIntoView({ behavior: 'smooth' })}>
                Consultar disponibilidad →
              </button>
            </FadeUp>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          TEMPORADAS
      ════════════════════════════════════════════ */}
      {on('season_prices') && seasonsShow.length > 0 && (
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
                      <div style={{ fontSize: '.72rem', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>{s.date_range}</div>
                      {s.notes && <div className="t1-season-dates">{s.notes}</div>}
                    </div>
                    <div className="t1-season-price">{s.price_modifier}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          QUÉ INCLUYE
      ════════════════════════════════════════════ */}
      {on('inclusions') && inclusionsShow.length > 0 && (
        <section className="t1-sec" style={{ background: '#0e0e0e' }}>
          <div className="w">
            <FadeUp>
              <span className="t1-label">Qué incluye</span>
              <h2 className="t1-h2">Todo lo que necesitáis,<br />sin sorpresas</h2>
            </FadeUp>
            <div className="t1-inc-grid">
              {inclusionsShow.map((inc: any, i: number) => (
                <FadeUp key={i} delay={(i % 4) * .05}>
                  <div className="t1-inc">
                    <span className="t1-inc-emoji">{inc.emoji || '✦'}</span>
                    <div>
                      <div className="t1-inc-title">{inc.title}</div>
                      {inc.description && <div className="t1-inc-desc">{inc.description}</div>}
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          MENÚS
      ════════════════════════════════════════════ */}
      {on('menu') && menuShow.length > 0 && (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">Gastronomía</span>
              <h2 className="t1-h2">Nuestros menús</h2>
            </FadeUp>
            {menuShow.map((m: any, i: number) => (
              <FadeUp key={i} delay={i * .06}>
                <div className="t1-menu-row">
                  <div>
                    <div className="t1-menu-name">{m.name}</div>
                    {m.description && <div className="t1-menu-desc">{m.description}</div>}
                    {m.min_guests && <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.22)', marginTop: 3 }}>Mín. {m.min_guests} comensales</div>}
                  </div>
                  <div className="t1-menu-price">{m.price_per_person}<span style={{ fontSize: '.75rem', color: 'rgba(255,255,255,.3)', fontFamily: 'Inter,sans-serif', fontWeight: 300 }}>/pers.</span></div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          TESTIMONIALES
      ════════════════════════════════════════════ */}
      {on('testimonials') && testsShow.length > 0 && (
        <section className="t1-sec" style={{ background: '#050505' }}>
          <div className="w">
            <FadeUp>
              <span className="t1-label">Lo dicen nuestras parejas</span>
              <h2 className="t1-h2">Experiencias reales</h2>
            </FadeUp>
            <div className="t1-tests">
              {testsShow.map((t: any, i: number) => {
                const initials = (t.couple_name || t.names || '?').split(/[\s&+y]/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')
                return (
                  <FadeUp key={i} delay={i * .1}>
                    <div className="t1-test">
                      <div className="t1-test-qmark">"</div>
                      <div className="t1-test-stars">{'★'.repeat(t.rating ?? 5)}</div>
                      <p className="t1-test-text">"{t.text}"</p>
                      <div className="t1-test-foot">
                        {t.photo_url
                          ? <div className="t1-test-av"><img src={t.photo_url} alt={t.couple_name} /></div>
                          : <div className="t1-test-av-ph">{initials}</div>
                        }
                        <div>
                          <div className="t1-test-couple">{t.couple_name || t.names}</div>
                          {(t.wedding_date || t.date) && <div className="t1-test-date">{t.wedding_date || t.date}</div>}
                        </div>
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          COLABORADORES
      ════════════════════════════════════════════ */}
      {on('collaborators') && collabsShow.length > 0 && (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">Proveedores de confianza</span>
              <h2 className="t1-h2">Nuestros colaboradores</h2>
              <p style={{ fontSize: '.9rem', color: 'rgba(255,255,255,.38)', lineHeight: 1.8, maxWidth: 560, marginBottom: 48, marginTop: -32 }}>
                Trabajamos sin exclusividad, pero os recomendamos a quienes conocemos y en quienes confiamos.
              </p>
            </FadeUp>
          </div>
          <div className="t1-collabs-grid">
            {collabsShow.map((c: any, i: number) => (
              <FadeUp key={i} delay={(i % 4) * .05}>
                <div className="t1-collab">
                  <div className="t1-collab-cat">{c.category}</div>
                  <div className="t1-collab-name">{c.name}</div>
                  {c.description && <div className="t1-collab-desc">{c.description}</div>}
                </div>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          ALOJAMIENTO
      ════════════════════════════════════════════ */}
      {on('accommodation') && accom && (
        <section className="t1-sec" style={{ background: '#0e0e0e' }}>
          <div className="w">
            <FadeUp>
              <span className="t1-label">Alojamiento en la finca</span>
              <h2 className="t1-h2">Quedaos a dormir</h2>
            </FadeUp>
            <div className="t1-accom">
              <FadeUp>
                <div>
                  <p style={{ fontSize: '.95rem', color: 'rgba(255,255,255,.5)', lineHeight: 1.85, marginBottom: 24 }}>{accom.description}</p>
                  {accom.rooms && (
                    <div className="t1-accom-rooms-list">
                      {accom.rooms.split('·').map((r: string, i: number) => (
                        <div key={i} className="t1-accom-room">{r.trim()}</div>
                      ))}
                    </div>
                  )}
                </div>
              </FadeUp>
              <FadeUp delay={.1}>
                {accom.price_info && (
                  <div>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 16 }}>Tarifas</div>
                    <p style={{ fontSize: '.88rem', color: 'rgba(255,255,255,.45)', lineHeight: 1.85 }}>{accom.price_info}</p>
                  </div>
                )}
                {accom.nearby && (
                  <div style={{ marginTop: 28 }}>
                    <div style={{ fontSize: '.62rem', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.25)', marginBottom: 12 }}>Alojamientos cercanos</div>
                    <p style={{ fontSize: '.85rem', color: 'rgba(255,255,255,.35)', lineHeight: 1.75 }}>{accom.nearby}</p>
                  </div>
                )}
              </FadeUp>
            </div>
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          SERVICIOS ADICIONALES
      ════════════════════════════════════════════ */}
      {on('extra_services') && extrasShow.length > 0 && (
        <section className="t1-sec">
          <div className="w">
            <FadeUp>
              <span className="t1-label">Personaliza</span>
              <h2 className="t1-h2">Servicios adicionales</h2>
            </FadeUp>
            {extrasShow.map((svc: any, i: number) => (
              <FadeUp key={i} delay={i * .05}>
                <div className="t1-extra-row">
                  <div>
                    <div className="t1-extra-name">{svc.name}</div>
                    {svc.description && <div className="t1-extra-desc">{svc.description}</div>}
                  </div>
                  {svc.price && <span className="t1-extra-price">{svc.price}</span>}
                </div>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          FAQ
      ════════════════════════════════════════════ */}
      {on('faq') && faqShow.length > 0 && (
        <section className="t1-sec" style={{ background: '#050505' }}>
          <div className="w-sm">
            <FadeUp>
              <span className="t1-label">Dudas</span>
              <h2 className="t1-h2">Preguntas frecuentes</h2>
            </FadeUp>
            {faqShow.map((item: any, i: number) => (
              <FadeUp key={i} delay={i * .04}>
                <div className="t1-faq-item">
                  <button className={`t1-faq-q ${openFaq === i ? 'open' : ''}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span className="t1-faq-q-text">{item.question}</span>
                    <span className="t1-faq-plus" style={{ transform: openFaq === i ? 'rotate(45deg)' : 'none' }}>+</span>
                  </button>
                  <div className="t1-faq-a" style={{ maxHeight: openFaq === i ? '400px' : '0' }}>
                    <div className="t1-faq-a-inner">{item.answer}</div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════
          CTA
      ════════════════════════════════════════════ */}
      <section className="t1-cta" id="t1-cta">
        <div className="w">
          {ctaSent ? (
            <FadeUp>
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ fontFamily: FONT, fontSize: '4rem', color: primary, marginBottom: 20, opacity: .6 }}>✦</div>
                <h2 style={{ fontFamily: FONT, fontSize: '3rem', fontWeight: 300, color: '#fff', marginBottom: 14 }}>¡Perfecto!</h2>
                <p style={{ fontSize: '.95rem', color: 'rgba(255,255,255,.4)' }}>Os contactaremos en menos de 24 horas.</p>
              </div>
            </FadeUp>
          ) : (
            <div className="t1-cta-grid">
              <FadeUp>
                <span className="t1-label">Siguiente paso</span>
                <h2 className="t1-cta-h">Hablemos de vuestra boda</h2>
                <p className="t1-cta-sub">
                  Os mostraremos la finca personalmente y resolveremos todas vuestras dudas. Respuesta garantizada en menos de 24 horas.
                </p>
                <div className="t1-cta-contact">
                  {venue?.contact_email && <div>✉ {venue.contact_email}</div>}
                  {venue?.contact_phone && <div>✆ {venue.contact_phone}</div>}
                  {venue?.website && <div>🌐 {venue.website}</div>}
                </div>
              </FadeUp>
              <FadeUp delay={.15}>
                <form className="t1-form" onSubmit={handleSubmit}>
                  {[
                    { k: 'name',    label: 'Vuestro nombre',    ph: couple_name,           type: 'text'  },
                    { k: 'email',   label: 'Email de contacto', ph: 'hola@ejemplo.com',    type: 'email' },
                    { k: 'phone',   label: 'Teléfono',          ph: '+34 600 000 000',     type: 'tel'   },
                    { k: 'message', label: 'Mensaje',           ph: 'Alguna pregunta...', type: 'text'  },
                  ].map(f => (
                    <div key={f.k}>
                      <label className="t1-field-label">{f.label}</label>
                      {f.k === 'message'
                        ? <textarea className="t1-input" rows={3} style={{ resize: 'vertical' }} placeholder={f.ph} value={(ctaF as any)[f.k]} onChange={e => setCtaF(p => ({ ...p, [f.k]: e.target.value }))} />
                        : <input className="t1-input" type={f.type} placeholder={f.ph} value={(ctaF as any)[f.k]} onChange={e => setCtaF(p => ({ ...p, [f.k]: e.target.value }))} />
                      }
                    </div>
                  ))}
                  <button type="submit" className="t1-btn" disabled={sending || !ctaF.name || !ctaF.email}>
                    {sending ? 'Enviando…' : 'Solicitar disponibilidad →'}
                  </button>
                </form>
              </FadeUp>
            </div>
          )}
        </div>
      </section>

      {/* ── FLOATING WHATSAPP ── */}
      <FloatingWhatsApp phone={venue?.contact_phone || ''} coupleName={couple_name} primary={primary} onPrimary={onPri} />

      {/* ── FOOTER ── */}
      <footer className="t1-footer">
        <div>
          {logo && <img src={logo} alt="" style={{ height: 20, objectFit: 'contain', opacity: .6, marginBottom: 8, display: 'block' }} />}
          <div style={{ fontFamily: FONT, fontSize: '1rem', color: 'rgba(255,255,255,.25)' }}>{venue?.name}</div>
          {venue?.city && <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.15)', marginTop: 3 }}>{venue.city}{venue.region ? `, ${venue.region}` : ''}</div>}
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
