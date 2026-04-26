'use client'
// T5 — Minimalista / Urgencia
// Post-visita: el cliente ya conoce el espacio. Sin relleno. Decisión rápida.
// Diseño: blanco puro + un único color primario muy presente + tipografía grande

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
import {
  extractData, formatDate, formatPrice, isDark, toRgb,
  FadeUp, FadeIn,
  FloatingWhatsApp, AvailabilityBanner, Gallery,
  IcoChat, IcoBuilding, IcoUsers, InclusionIcon, StarRating,
  resolveContact, VenueRentalGrid,
  formatZoneCapacities, formatZoneFeatures,
} from './shared'
import { buildSingleFontUrl } from '@/lib/fonts'
import { WeddingProposal } from './WeddingProposal'
import VisitBookingModal from '@/components/VisitBookingModal'

// ─── Palette ──────────────────────────────────────────────────────────────────
const WHITE = '#FFFFFF'
const OFF   = '#F9F9F7'
const GRAY  = '#F2F2F0'
const INK   = '#111111'
const MUTED = '#888888'
const LINE  = '#E8E8E8'

// ─── CSS ──────────────────────────────────────────────────────────────────────
const buildCss = (pri: string, priRgb: string, darkPri: boolean, font: string) => `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }

  .t5 {
    font-family: 'DM Sans', sans-serif;
    background: ${WHITE};
    color: ${INK};
    overflow-x: hidden;
  }

  /* ── Progress bar ── */
  .t5-progress {
    position: fixed; top: 0; left: 0; height: 3px;
    background: ${pri}; z-index: 200;
    transition: width .1s linear;
  }

  /* ── Nav ── */
  .t5-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 56px; height: 68px;
    background: rgba(255,255,255,.95); backdrop-filter: blur(12px);
    border-bottom: 1px solid transparent;
    transition: border-color .3s;
  }
  .t5-nav.scrolled { border-bottom-color: ${LINE} }
  .t5-logo { height: 32px; width: auto; object-fit: contain }
  .t5-nav-right { display: flex; align-items: center; gap: 20px }
  .t5-nav-link {
    font-size: .78rem; font-weight: 500; color: ${MUTED};
    background: none; border: none; cursor: pointer; letter-spacing: .03em;
    transition: color .2s;
  }
  .t5-nav-link:hover { color: ${INK} }
  .t5-nav-cta {
    background: ${INK}; color: #fff;
    border: none; padding: 10px 24px;
    font-size: .78rem; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
    cursor: pointer; transition: background .2s;
  }
  .t5-nav-cta:hover { background: ${pri} }

  /* ── Hero ── */
  .t5-hero {
    display: grid; grid-template-columns: 1fr 1fr;
    min-height: 100vh; padding-top: 68px;
  }
  .t5-hero-left {
    display: flex; flex-direction: column; justify-content: center;
    padding: 80px 72px 80px 80px;
    background: ${WHITE};
  }
  .t5-hero-tag {
    font-size: .68rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
    color: ${pri}; margin-bottom: 24px;
  }
  .t5-hero-couple {
    font-family: ${font}; font-size: clamp(2.8rem, 5vw, 4.4rem);
    line-height: 1.05; color: ${INK}; margin-bottom: 28px;
  }
  .t5-hero-couple em { font-style: italic; color: ${pri} }
  .t5-hero-desc {
    font-size: 1.02rem; line-height: 1.8; color: ${MUTED};
    max-width: 420px; margin-bottom: 40px;
  }
  .t5-hero-actions { display: flex; flex-direction: column; gap: 16px; align-items: flex-start }
  .t5-hero-btn-primary {
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    border: none; padding: 18px 44px;
    font-size: .88rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    cursor: pointer; transition: opacity .2s, transform .2s;
    display: inline-flex; align-items: center; gap: 10px;
  }
  .t5-hero-btn-primary:hover { opacity: .9; transform: translateX(3px) }
  .t5-hero-btn-secondary {
    background: none; border: none; cursor: pointer;
    font-size: .83rem; color: ${MUTED}; display: flex; align-items: center; gap: 8px;
    text-decoration: underline; text-underline-offset: 3px;
    transition: color .2s;
  }
  .t5-hero-btn-secondary:hover { color: ${INK} }
  .t5-hero-data {
    margin-top: 56px; display: flex; gap: 40px; flex-wrap: wrap;
    padding-top: 40px; border-top: 1px solid ${LINE};
  }
  .t5-hero-datum { display: flex; flex-direction: column; gap: 4px }
  .t5-hero-datum-val {
    font-family: ${font}; font-size: 1.8rem; color: ${INK};
  }
  .t5-hero-datum-lbl { font-size: .72rem; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; color: ${MUTED} }

  .t5-hero-right {
    position: relative; overflow: hidden; background: ${GRAY};
  }
  .t5-hero-img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .1s linear;
    transform-origin: center center;
  }
  .t5-hero-img-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to bottom right, rgba(${priRgb},.08), transparent);
    pointer-events: none;
  }

  /* ── Urgency bar ── */
  .t5-urgency {
    background: ${INK}; padding: 16px 56px;
    display: flex; align-items: center; justify-content: center; gap: 12px;
  }
  .t5-urgency-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: ${pri}; flex-shrink: 0;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1 } 50% { opacity: .4 }
  }
  .t5-urgency-text { font-size: .82rem; color: rgba(255,255,255,.8); font-weight: 400 }
  .t5-urgency-text strong { color: #fff; font-weight: 600 }
  .t5-urgency-cta {
    margin-left: 16px;
    background: none; border: 1px solid rgba(${priRgb},.6); color: ${pri};
    padding: 6px 18px; font-size: .75rem; font-weight: 600; letter-spacing: .06em;
    text-transform: uppercase; cursor: pointer; transition: all .2s; white-space: nowrap;
  }
  .t5-urgency-cta:hover { background: ${pri}; color: ${darkPri ? '#fff' : INK}; border-color: ${pri} }

  /* ── INCLUSIONS BLOCK — full primary color ── */
  .t5-inc-block {
    background: ${pri};
    padding: 96px 0;
  }
  .t5-inc-inner { max-width: 1100px; margin: 0 auto; padding: 0 56px }
  .t5-inc-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 64px; gap: 24px; flex-wrap: wrap }
  .t5-inc-tag {
    font-size: .68rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
    color: rgba(${darkPri ? '255,255,255' : '0,0,0'},.5); margin-bottom: 12px;
  }
  .t5-inc-title {
    font-family: ${font};
    font-size: clamp(2rem, 3.5vw, 3rem);
    color: ${darkPri ? '#fff' : INK}; line-height: 1.15;
  }
  .t5-inc-sub {
    font-size: .9rem; color: rgba(${darkPri ? '255,255,255' : '0,0,0'},.6);
    max-width: 360px; line-height: 1.65; align-self: flex-end;
  }
  .t5-inc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 2px; align-items: stretch;
  }
  .t5-inc-grid > * { height: 100% }
  .t5-inc-item {
    padding: 28px 24px;
    background: rgba(${darkPri ? '255,255,255' : '0,0,0'},.06);
    transition: background .2s;
    height: 100%; display: flex; flex-direction: column;
  }
  .t5-inc-item:hover { background: rgba(${darkPri ? '255,255,255' : '0,0,0'},.1) }
  .t5-inc-emoji { font-size: 1.5rem; margin-bottom: 12px; display: block }
  .t5-inc-name {
    font-size: .9rem; font-weight: 600;
    color: ${darkPri ? '#fff' : INK}; margin-bottom: 6px;
  }
  .t5-inc-desc {
    font-size: .78rem; line-height: 1.6;
    color: rgba(${darkPri ? '255,255,255' : '0,0,0'},.55);
  }

  /* ── Receipt / Pricing ── */
  .t5-pricing-section {
    background: ${OFF}; padding: 96px 0;
  }
  .t5-pricing-inner { max-width: 680px; margin: 0 auto; padding: 0 40px }
  .t5-pricing-tag {
    font-size: .68rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase;
    color: ${pri}; margin-bottom: 14px;
  }
  .t5-pricing-title {
    font-family: ${font}; font-size: clamp(2rem, 4vw, 3rem);
    color: ${INK}; line-height: 1.15; margin-bottom: 48px;
  }
  .t5-receipt {
    background: ${WHITE}; border: 1px solid ${LINE};
  }
  .t5-receipt-header {
    background: ${INK}; color: #fff;
    padding: 20px 32px; display: flex; justify-content: space-between; align-items: center;
  }
  .t5-receipt-header-venue { font-family: ${font}; font-size: 1.1rem }
  .t5-receipt-header-date { font-size: .78rem; color: rgba(255,255,255,.5) }
  .t5-receipt-couple {
    padding: 24px 32px 18px;
    border-bottom: 1px dashed ${LINE};
    font-size: .82rem; color: ${MUTED};
  }
  .t5-receipt-couple strong { font-size: 1.1rem; color: ${INK}; font-weight: 600; display: block; margin-bottom: 2px }
  .t5-receipt-body { padding: 0 }
  .t5-receipt-row {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: 14px 32px; gap: 20px;
    border-bottom: 1px solid ${LINE};
  }
  .t5-receipt-row:last-child { border-bottom: none }
  .t5-receipt-row.pkg {
    background: rgba(${priRgb},.04);
    border-left: 3px solid ${pri};
  }
  .t5-receipt-row-name { font-size: .9rem; color: ${INK}; font-weight: 500 }
  .t5-receipt-row-detail { font-size: .75rem; color: ${MUTED}; margin-top: 2px }
  .t5-receipt-row-price { font-size: .9rem; font-weight: 600; color: ${INK}; white-space: nowrap }
  .t5-receipt-total {
    display: flex; justify-content: space-between; align-items: center;
    padding: 24px 32px;
    background: ${INK}; color: #fff;
    margin-top: 0;
  }
  .t5-receipt-total-lbl { font-size: .78rem; letter-spacing: .1em; text-transform: uppercase; opacity: .6 }
  .t5-receipt-total-val {
    font-family: ${font};
    font-size: 2.2rem; color: ${pri};
  }
  .t5-receipt-note {
    padding: 16px 32px;
    font-size: .75rem; color: ${MUTED}; text-align: center;
    border-top: 1px solid ${LINE};
    background: ${WHITE};
  }

  /* ── Packages ── */
  .t5-pkg-section { padding: 96px 0; background: ${WHITE} }
  .t5-pkg-inner { max-width: 1100px; margin: 0 auto; padding: 0 56px }
  .t5-pkg-tag { font-size: .68rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: ${pri}; margin-bottom: 14px }
  .t5-pkg-title { font-family: ${font}; font-size: clamp(2rem, 3.5vw, 3rem); color: ${INK}; margin-bottom: 56px }
  .t5-pkgs {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1px; background: ${LINE};
    border: 1px solid ${LINE};
  }
  .t5-pkg {
    background: ${WHITE}; padding: 36px 32px;
    position: relative; transition: background .2s;
  }
  .t5-pkg:hover { background: ${OFF} }
  .t5-pkg.recommended { background: ${INK} }
  .t5-pkg.recommended:hover { background: rgba(0,0,0,.92) }
  .t5-pkg-badge {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: .6rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: ${pri}; background: rgba(${priRgb}, .12); padding: 4px 10px; border-radius: 100px;
    margin-bottom: 10px;
  }
  .t5-pkg-badge::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: ${pri} }
  .t5-pkg.recommended .t5-pkg-badge { background: rgba(${priRgb}, .22) }
  .t5-pkg-name {
    font-family: ${font}; font-size: 1.4rem;
    color: ${INK}; margin-bottom: 6px;
  }
  .t5-pkg.recommended .t5-pkg-name { color: #fff }
  .t5-pkg-sub { font-size: .8rem; color: ${MUTED}; margin-bottom: 20px }
  .t5-pkg.recommended .t5-pkg-sub { color: rgba(255,255,255,.5) }
  .t5-pkg-price {
    font-family: ${font}; font-size: 2.6rem;
    line-height: 1; margin-bottom: 6px; color: ${pri};
  }
  .t5-pkg-price-note { font-size: .75rem; color: ${MUTED}; margin-bottom: 24px }
  .t5-pkg.recommended .t5-pkg-price-note { color: rgba(255,255,255,.4) }
  .t5-pkg-sep { height: 1px; background: ${LINE}; margin-bottom: 20px }
  .t5-pkg.recommended .t5-pkg-sep { background: rgba(255,255,255,.1) }
  .t5-pkg-includes { list-style: none; display: flex; flex-direction: column; gap: 9px }
  .t5-pkg-includes li { font-size: .82rem; color: ${MUTED}; display: flex; gap: 10px; align-items: baseline }
  .t5-pkg.recommended .t5-pkg-includes li { color: rgba(255,255,255,.65) }
  .t5-pkg-includes li::before {
    content: '—'; color: ${pri}; font-weight: 700; flex-shrink: 0;
    font-size: .7rem;
  }
  .t5-pkg-cta {
    display: block; margin-top: 24px; width: 100%;
    padding: 13px; text-align: center;
    font-size: .78rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    background: none; border: 1px solid ${LINE}; color: ${INK}; cursor: pointer;
    transition: all .2s;
  }
  .t5-pkg-cta:hover { background: ${pri}; color: ${darkPri ? '#fff' : INK}; border-color: ${pri} }
  .t5-pkg.recommended .t5-pkg-cta {
    background: ${pri}; color: ${darkPri ? '#fff' : INK}; border-color: transparent;
  }
  .t5-pkg.recommended .t5-pkg-cta:hover { opacity: .9 }

  /* ── CTA mega section ── */
  .t5-cta-section {
    background: ${WHITE};
    padding: 120px 0 0;
  }
  .t5-cta-inner {
    max-width: 1100px; margin: 0 auto; padding: 0 56px;
  }
  .t5-cta-top {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 80px; align-items: start;
    padding-bottom: 80px; border-bottom: 1px solid ${LINE};
  }
  .t5-cta-heading {
    font-family: ${font}; font-style: italic;
    font-size: clamp(2.4rem, 5vw, 4rem); line-height: 1.1; color: ${INK};
  }
  .t5-cta-heading span { color: ${pri}; font-style: normal }
  .t5-cta-desc { font-size: .95rem; color: ${MUTED}; line-height: 1.8; margin-top: 20px }
  .t5-cta-bullets { margin-top: 28px; display: flex; flex-direction: column; gap: 10px }
  .t5-cta-bullet { display: flex; gap: 12px; align-items: baseline }
  .t5-cta-bullet::before { content: '→'; color: ${pri}; font-size: .8rem; flex-shrink: 0 }
  .t5-cta-bullet-text { font-size: .88rem; color: ${INK}; font-weight: 500 }
  .t5-form {
    display: flex; flex-direction: column; gap: 0;
    border: 1px solid ${LINE};
  }
  .t5-form-title {
    background: ${INK}; color: #fff; padding: 22px 28px;
    font-family: ${font}; font-size: 1.2rem;
  }
  .t5-form-body { padding: 28px; display: flex; flex-direction: column; gap: 0 }
  .t5-form-row { display: flex; flex-direction: column }
  .t5-form-label {
    font-size: .68rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: ${MUTED}; padding: 14px 0 6px;
  }
  .t5-form-row:first-child .t5-form-label { padding-top: 0 }
  .t5-form-input {
    background: none; border: none; border-bottom: 1.5px solid ${LINE};
    padding: 8px 0; font-size: .92rem; font-family: 'DM Sans', sans-serif;
    color: ${INK}; outline: none; transition: border-color .2s;
  }
  .t5-form-input::placeholder { color: ${MUTED} }
  .t5-form-input:focus { border-bottom-color: ${pri} }
  .t5-form-textarea { resize: vertical; min-height: 80px }
  .t5-form-submit {
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    border: none; padding: 18px 0;
    font-size: .88rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    cursor: pointer; margin-top: 24px; width: 100%;
    transition: opacity .2s;
    display: flex; align-items: center; justify-content: center; gap: 10px;
  }
  .t5-form-submit:hover { opacity: .9 }

  /* ── Footer ── */
  .t5-footer-wrap {
    max-width: 1100px; margin: 80px auto 0;
    padding: 40px 56px;
    border-top: 1px solid ${LINE};
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;
  }
  .t5-footer-logo { height: 26px; object-fit: contain; opacity: .5 }
  .t5-footer-text { font-size: .75rem; color: ${MUTED} }
  .t5-footer-links { display: flex; gap: 20px }
  .t5-footer-links a { font-size: .75rem; color: ${MUTED}; text-decoration: none; transition: color .2s }
  .t5-footer-links a:hover { color: ${INK} }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .t5-hero { grid-template-columns: 1fr; min-height: auto }
    .t5-hero-left { padding: 60px 32px }
    .t5-hero-right { min-height: 55vw }
    .t5-cta-top { grid-template-columns: 1fr; gap: 40px }
    .t5-pkg-inner, .t5-cta-inner, .t5-inc-inner { padding: 0 24px }
    .t5-pricing-inner { padding: 0 24px }
    .t5-footer-wrap { padding: 32px 24px }
    .t5-nav { padding: 0 24px }
    .t5-urgency { padding: 12px 24px; flex-wrap: wrap }
  }
  @media (max-width: 600px) {
    .t5-pkgs { grid-template-columns: 1fr }
    .t5-inc-grid { grid-template-columns: 1fr 1fr }
    .t5-nav-link { display: none }
    .t5-hero-data { gap: 24px }
  }
`

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function T5Minimalista({ data }: { data: ProposalData }) {
  const { sec, on, hasCatering, packagesShow, inclusionsShow, expShow, faqShow, menuShow, menusStructured, menuExtras, appetizersBase, zonesShow, seasonsShow, testsShow, collabsShow, extrasShow, accom } = extractData(data)

  const branding  = data.branding
  const primary   = branding?.primary_color || '#1A1A1A'
  const priRgb    = toRgb(primary)
  const darkPri   = isDark(primary)
  const font      = (branding as any)?.font_family || "'DM Sans', sans-serif"
  const venueName = data.venue?.name || ''
  const contact   = resolveContact(data)
  const contactOn = on('contact') && (contact.phone || contact.email)
  const photos    = data.venue?.photo_urls || []
  const secData   = (data as any).sections_data || {}
  const heroPhoto = secData.hero_image_url || photos[0] || ''
  const galleryPhotos = secData.gallery_urls?.length ? secData.gallery_urls : photos.slice(1)

  const heroImgRef = useRef<HTMLImageElement>(null)
  const [visitModalOpen, setVisitModalOpen] = useState(false)
  const [visitDone,      setVisitDone]      = useState(false)
  const [scrolled, setScrolled]     = useState(false)
  const [progress, setProgress]     = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const y    = window.scrollY
      const maxY = document.body.scrollHeight - window.innerHeight
      setScrolled(y > 20)
      setProgress(maxY > 0 ? (y / maxY) * 100 : 0)
      if (heroImgRef.current) {
        heroImgRef.current.style.transform = `scale(1.04) translateY(${y * 0.12}px)`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Load branded font from Google Fonts when it changes
  useEffect(() => {
    const url = buildSingleFontUrl(font); if (!url) return
    const ex = document.querySelector('link[data-gf-p]')
    if (ex) { ex.setAttribute('href', url); return }
    const l = document.createElement('link'); l.rel='stylesheet'; l.href=url; l.setAttribute('data-gf-p','1')
    document.head.appendChild(l)
  }, [font])

  const [faqOpen, setFaqOpen]   = useState<number | null>(null)

  const activePkgs = packagesShow.filter((p: any) => p.is_active !== false)

  return (
    <div className="t5 tpl-root">
      <style dangerouslySetInnerHTML={{ __html: buildCss(primary, priRgb, darkPri, font) }} />

      {/* SCROLL PROGRESS */}
      <div className="t5-progress" style={{ width: `${progress}%` }} />

      {/* NAV */}
      <nav className={`t5-nav ${scrolled ? 'scrolled' : ''}`}>
        {branding?.logo_url
          ? <img src={branding.logo_url} className="t5-logo" alt={venueName} />
          : <span style={{ fontFamily: font, fontSize: '1.1rem' }}>{venueName}</span>
        }
        <div className="t5-nav-right">
          {inclusionsShow.length > 0 && (
            <button className="t5-nav-link" onClick={() => document.getElementById('t5-inc')?.scrollIntoView({ behavior: 'smooth' })}>
              Qué incluye
            </button>
          )}
          {activePkgs.length > 0 && (
            <button className="t5-nav-link" onClick={() => document.getElementById('t5-pkg')?.scrollIntoView({ behavior: 'smooth' })}>
              Paquetes
            </button>
          )}
          <button className="t5-nav-cta" onClick={() => (document.getElementById(hasCatering ? 'menu' : 't5-cta') ?? document.getElementById('t5-cta'))?.scrollIntoView({ behavior: 'smooth' })}>
            {hasCatering ? 'Ver menús' : 'Contactar'}
          </button>
        </div>
      </nav>

      {/* HERO — 2 columns */}
      <section className="t5-hero">
        {/* Left */}
        <FadeIn>
          <div className="t5-hero-left">
            <p className="t5-hero-tag">Propuesta personalizada · {venueName}</p>
            <h1 className="t5-hero-couple">
              {data.couple_name.includes('&') || data.couple_name.includes(' y ') || data.couple_name.includes(' + ')
                ? data.couple_name.split(/(&| y | \+ )/).map((part, i) =>
                    i % 2 === 0
                      ? <span key={i}>{part.trim()}</span>
                      : <em key={i}> {part.trim()} </em>
                  )
                : data.couple_name
              }
            </h1>
            {data.personal_message && (
              <p className="t5-hero-desc">{data.personal_message.slice(0, 200)}{data.personal_message.length > 200 ? '…' : ''}</p>
            )}
            <div className="t5-hero-actions">
              <button className="t5-hero-btn-primary" onClick={() => (document.getElementById(hasCatering ? 'menu' : 't5-cta') ?? document.getElementById('t5-cta'))?.scrollIntoView({ behavior: 'smooth' })}>
                {hasCatering ? 'Ver menús' : 'Solicitar info'} <span>→</span>
              </button>
              {activePkgs.length > 0 && (
                <button className="t5-hero-btn-secondary" onClick={() => document.getElementById('t5-pkg')?.scrollIntoView({ behavior: 'smooth' })}>
                  Ver paquetes y precios
                </button>
              )}
            </div>
            <div className="t5-hero-data">
              {data.wedding_date && (
                <div className="t5-hero-datum">
                  <span className="t5-hero-datum-val">{new Date(data.wedding_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                  <span className="t5-hero-datum-lbl">Fecha propuesta</span>
                </div>
              )}
              {data.guest_count && (
                <div className="t5-hero-datum">
                  <span className="t5-hero-datum-val">{data.guest_count}</span>
                  <span className="t5-hero-datum-lbl">Invitados</span>
                </div>
              )}
              {data.show_price_estimate && data.price_estimate && (
                <div className="t5-hero-datum">
                  <span className="t5-hero-datum-val" style={{ color: primary }}>{formatPrice(data.price_estimate)}</span>
                  <span className="t5-hero-datum-lbl">Precio estimado</span>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
        {/* Right — foto */}
        <div className="t5-hero-right">
          {heroPhoto && (
            <img
              ref={heroImgRef}
              src={heroPhoto}
              className="t5-hero-img"
              alt={venueName}
              style={{ transform: 'scale(1.04)' }}
            />
          )}
          <div className="t5-hero-img-overlay" />
        </div>
      </section>

      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />
      )}

      {/* URGENCY BAR */}
      {data.show_availability && (
        <div className="t5-urgency">
          <div className="t5-urgency-dot" />
          <p className="t5-urgency-text">
            <strong>Fecha disponible</strong> — Las fechas de temporada alta se agotan rápido. Reserva con prioridad.
          </p>
          <button className="t5-urgency-cta" onClick={() => (document.getElementById(hasCatering ? 'menu' : 't5-cta') ?? document.getElementById('t5-cta'))?.scrollIntoView({ behavior: 'smooth' })}>
            {hasCatering ? 'Ver menús' : 'Solicitar información'}
          </button>
        </div>
      )}

      {/* EXPERIENCE */}
      {on('experience') && expShow && (expShow as any).body && (
        <section style={{ padding: '80px 0', background: WHITE }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>La experiencia</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 24 }}>{(expShow as any).title || 'Vuestro día especial'}</h2>
              <p style={{ fontSize: '1rem', color: MUTED, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{(expShow as any).body}</p>
            </FadeUp>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {on('gallery') && galleryPhotos.length > 0 && (
        <Gallery photos={galleryPhotos} primary={primary} dark={false} />
      )}

      {/* ZONES */}
      {on('zones') && zonesShow.length > 0 && (
        <section style={{ padding: '80px 0', background: OFF }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Los espacios</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 48 }}>Cada rincón del venue</h2>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 1, background: LINE, border: `1px solid ${LINE}` }}>
              {zonesShow.map((z: any, i: number) => {
                const zPhoto = z.photos?.[0] || photos[i + 2]
                const caps = formatZoneCapacities(z)
                const feats = formatZoneFeatures(z)
                return (
                  <FadeUp key={i} delay={(i % 3) * .06}>
                    <div style={{ background: WHITE, display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: GRAY }}>
                        {zPhoto
                          ? <img src={zPhoto} alt={z.name} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}><IcoBuilding width={40} height={40} /></div>
                        }
                      </div>
                      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                        <h3 style={{ fontFamily: font, fontSize: 20, color: INK }}>{z.name}</h3>
                        {z.description && <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>{z.description}</p>}
                        {caps.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: primary, fontWeight: 600, marginTop: 2 }}>
                            {caps.map((c, ci) => <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoUsers width={10} height={10} />{c}</span>)}
                          </div>
                        )}
                        {feats.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {feats.map((f, fi) => (
                              <span key={fi} style={{ fontSize: 10.5, padding: '2px 8px', border: `1px solid ${LINE}`, color: MUTED, letterSpacing: '.02em' }}>{f}</span>
                            ))}
                          </div>
                        )}
                        {z.notes && <div style={{ fontSize: 11.5, color: MUTED, fontStyle: 'italic', marginTop: 4 }}>{z.notes}</div>}
                        {z.price && <div style={{ fontFamily: font, fontSize: 16, color: primary, marginTop: 4 }}>{z.price}</div>}
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* INCLUSIONS — bloque de color primario */}
      {inclusionsShow.length > 0 && on('inclusions') && (
        <section className="t5-inc-block" id="t5-inc">
          <div className="t5-inc-inner">
            <FadeUp>
              <div className="t5-inc-header">
                <div>
                  <p className="t5-inc-tag">Qué incluye</p>
                  <h2 className="t5-inc-title">Todo lo que necesitáis,<br/>sin sorpresas</h2>
                </div>
                <p className="t5-inc-sub">
                  Cada detalle ha sido pensado para que vosotros solo tengáis que disfrutar del día.
                </p>
              </div>
            </FadeUp>
            <div className="t5-inc-grid">
              {inclusionsShow.map((inc: any, i: number) => (
                <FadeUp key={i} delay={i * .03}>
                  <div className="t5-inc-item">
                    <span className="t5-inc-emoji" style={{ display: 'inline-flex', color: primary }}>
                      <InclusionIcon name={inc.icon || inc.emoji || 'check'} size={26} color={primary} strokeWidth={1.5} />
                    </span>
                    <div className="t5-inc-name">{inc.title}</div>
                    {inc.description && <div className="t5-inc-desc">{inc.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RECEIPT / PRICING */}
      {data.show_price_estimate && data.price_estimate && (
        <section className="t5-pricing-section">
          <FadeUp>
            <div className="t5-pricing-inner">
              <p className="t5-pricing-tag">Vuestra propuesta</p>
              <h2 className="t5-pricing-title">El resumen de vuestra boda</h2>
              <div className="t5-receipt">
                <div className="t5-receipt-header">
                  <span className="t5-receipt-header-venue">{venueName}</span>
                  <span className="t5-receipt-header-date">
                    {data.wedding_date
                      ? new Date(data.wedding_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                      : 'Fecha a confirmar'
                    }
                  </span>
                </div>
                <div className="t5-receipt-couple">
                  <strong>{data.couple_name}</strong>
                  {data.guest_count ? `${data.guest_count} invitados` : ''}
                </div>
                <div className="t5-receipt-body">
                  {activePkgs.slice(0, 3).map((pkg: any, i: number) => (
                    <div key={i} className={`t5-receipt-row ${pkg.is_recommended ? 'pkg' : ''}`}>
                      <div>
                        <div className="t5-receipt-row-name">{pkg.name}</div>
                        {pkg.subtitle && <div className="t5-receipt-row-detail">{pkg.subtitle}</div>}
                      </div>
                      <div className="t5-receipt-row-price">{pkg.price || '—'}</div>
                    </div>
                  ))}
                  {inclusionsShow.slice(0, 4).map((inc: any, i: number) => (
                    <div key={i} className="t5-receipt-row">
                      <div>
                        <div className="t5-receipt-row-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: primary, display: 'inline-flex' }}>
                            <InclusionIcon name={inc.icon || inc.emoji || 'check'} size={14} color={primary} />
                          </span>
                          {inc.title}
                        </div>
                      </div>
                      <div className="t5-receipt-row-price" style={{ color: primary }}>Incluido</div>
                    </div>
                  ))}
                </div>
                <div className="t5-receipt-total">
                  <span className="t5-receipt-total-lbl">Total estimado</span>
                  <span className="t5-receipt-total-val">{formatPrice(data.price_estimate)}</span>
                </div>
                <div className="t5-receipt-note">
                  * Precio orientativo para {data.guest_count || '—'} invitados. El precio final se confirma tras la visita.
                </div>
              </div>
            </div>
          </FadeUp>
        </section>
      )}

      {/* PACKAGES */}
      {activePkgs.length > 0 && on('packages') && (
        <section className="t5-pkg-section" id="t5-pkg">
          <div className="t5-pkg-inner">
            <FadeUp>
              <p className="t5-pkg-tag">Paquetes</p>
              <h2 className="t5-pkg-title">Elige tu experiencia</h2>
            </FadeUp>
            <div className="t5-pkgs">
              {activePkgs.map((pkg: any, i: number) => (
                <FadeUp key={i} delay={i * .1}>
                  <div className={`t5-pkg ${pkg.is_recommended ? 'recommended' : ''}`}>
                    {pkg.is_recommended && <span className="t5-pkg-badge">Más elegido</span>}
                    <div className="t5-pkg-name">{pkg.name}</div>
                    {pkg.subtitle && <div className="t5-pkg-sub">{pkg.subtitle}</div>}
                    {pkg.price && (
                      <>
                        <div className="t5-pkg-price">{pkg.price}</div>
                        <div className="t5-pkg-price-note">por persona · IVA incluido</div>
                      </>
                    )}
                    <div className="t5-pkg-sep" />
                    {pkg.includes?.length > 0 && (
                      <ul className="t5-pkg-includes">
                        {pkg.includes.map((inc: string, j: number) => (
                          <li key={j}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    <button
                      className="t5-pkg-cta"
                      onClick={() => (document.getElementById(hasCatering ? 'menu' : 't5-cta') ?? document.getElementById('t5-cta'))?.scrollIntoView({ behavior: 'smooth' })}
                    >
                      {hasCatering ? 'Ver menús' : 'Solicitar info'}
                    </button>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VENUE RENTAL — grid temporada × día */}
      {on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0 && (
        <section style={{ padding: '80px 0', background: OFF }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>{sec.venue_rental.title || 'Tarifas de alquiler'}</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Elegid vuestra fecha</h2>
            </FadeUp>
            <FadeUp delay={.1}>
              <VenueRentalGrid data={sec.venue_rental} primary={primary} />
            </FadeUp>
          </div>
        </section>
      )}

      {/* SEASON PRICES */}
      {on('season_prices') && seasonsShow.length > 0 && (
        <section style={{ padding: '80px 0', background: WHITE }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Temporadas</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Precios según la fecha</h2>
            </FadeUp>
            <div style={{ border: `1px solid ${LINE}` }}>
              {seasonsShow.map((s: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'center', padding: '18px 28px', borderBottom: i < seasonsShow.length - 1 ? `1px solid ${LINE}` : 'none' }}>
                    <div style={{ fontFamily: font, fontSize: 18, color: INK }}>{s.label || s.season}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: primary, marginBottom: 3 }}>{s.date_range}</div>
                      {s.notes && <div style={{ fontSize: 12, color: MUTED }}>{s.notes}</div>}
                    </div>
                    <div style={{ fontFamily: font, fontSize: 22, color: primary, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.price_modifier}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ minimal */}
      {faqShow.length > 0 && on('faq') && (
        <section style={{ padding: '80px 0', background: OFF }}>
          <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 40px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>FAQ</p>
              <h2 style={{ fontFamily: font, fontSize: '2rem', color: INK, marginBottom: 40 }}>Preguntas frecuentes</h2>
            </FadeUp>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {faqShow.map((f: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ borderBottom: `1px solid ${LINE}` }}>
                    <button
                      onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                      style={{
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        textAlign: 'left', gap: 16,
                      }}
                    >
                      <span style={{ fontSize: '.93rem', fontWeight: 600, color: faqOpen === i ? primary : INK }}>{f.question}</span>
                      <span style={{ fontSize: '1.2rem', color: primary, flexShrink: 0, fontWeight: 300, transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform .25s' }}>+</span>
                    </button>
                    <div style={{ overflow: 'hidden', maxHeight: faqOpen === i ? '300px' : '0', transition: 'max-height .35s cubic-bezier(.4,0,.2,1)' }}>
                      <p style={{ fontSize: '.88rem', color: MUTED, lineHeight: 1.75, paddingBottom: 20 }}>{f.answer}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
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
          onPrimary={darkPri ? '#fff' : '#111'}
        />
      )}

      {/* ACCOMMODATION */}
      {on('accommodation') && accom && (
        <section style={{ padding: '80px 0', background: OFF }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Alojamiento</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Quedaos a dormir</h2>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'start' }}>
              <FadeUp>
                <div>
                  {accom.description && <p style={{ fontSize: 14.5, color: MUTED, lineHeight: 1.85, marginBottom: 16 }}>{accom.description}</p>}
                  {accom.rooms && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {accom.rooms.split('·').map((r: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: INK }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />{r.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FadeUp>
              <FadeUp delay={.1}>
                {Array.isArray(accom.options) && accom.options.length > 0 ? (
                  <div style={{ background: WHITE, border: `1px solid ${LINE}`, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {accom.options.map((opt: any, oi: number) => (
                      <div key={oi} style={{ borderLeft: `3px solid ${primary}`, paddingLeft: 14 }}>
                        <div style={{ fontFamily: font, fontSize: 18, color: INK }}>{opt.label}</div>
                        {opt.description && <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{opt.description}</div>}
                        {opt.included ? (
                          <div style={{ fontSize: 12.5, color: primary, fontWeight: 600, marginTop: 5 }}>✓ Incluido en la tarifa del venue</div>
                        ) : opt.price_info ? (
                          <div style={{ fontSize: 14, color: INK, marginTop: 4 }}>{opt.price_info}</div>
                        ) : Array.isArray(opt.prices) && opt.prices.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {opt.prices.map((p: any, pi: number) => (
                              <div key={pi} style={{ display: 'flex', gap: 10, fontSize: 13, color: INK }}>
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
                  <div style={{ background: WHITE, border: `1px solid ${LINE}`, padding: 24 }}>
                    <p style={{ fontSize: 14, color: INK, lineHeight: 1.8 }}>{accom.price_info}</p>
                  </div>
                ) : null}
                {accom.nearby && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 6 }}>Alojamientos cercanos</div>
                    <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{accom.nearby}</p>
                  </div>
                )}
              </FadeUp>
            </div>
          </div>
        </section>
      )}

      {/* EXTRA SERVICES */}
      {on('extra_services') && extrasShow.length > 0 && (
        <section style={{ padding: '80px 0', background: WHITE }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Servicios adicionales</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Personaliza tu celebración</h2>
            </FadeUp>
            <div>
              {extrasShow.map((svc: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: `1px solid ${LINE}`, gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: INK }}>{svc.name}</div>
                      {svc.description && <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>{svc.description}</div>}
                    </div>
                    {svc.price && <span style={{ fontFamily: font, fontSize: 20, color: primary, whiteSpace: 'nowrap' }}>{svc.price}</span>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TESTIMONIALS */}
      {on('testimonials') && testsShow.length > 0 && (
        <section style={{ padding: '80px 0', background: OFF }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Lo dicen las parejas</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Experiencias reales</h2>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
              {testsShow.map((t: any, i: number) => {
                const name = t.couple_name || t.names || ''
                const rawDate = t.wedding_date || t.date
                const dateStr = rawDate && /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? formatDate(rawDate) : rawDate
                return (
                  <FadeUp key={i} delay={i * .06}>
                    <div style={{ background: WHITE, border: `1px solid ${LINE}`, padding: '28px 28px 22px', display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
                      <div style={{ color: '#F5A623', fontSize: 13 }}><StarRating rating={t.rating ?? 5} size={13} color="#F5A623" /></div>
                      <p style={{ fontFamily: font, fontStyle: 'italic', fontSize: 15.5, lineHeight: 1.7, color: INK, flex: 1 }}>"{t.text}"</p>
                      <div style={{ paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: INK }}>{name}</div>
                        {dateStr && <div style={{ fontSize: 11, color: primary, marginTop: 2, letterSpacing: '.08em', textTransform: 'uppercase' }}>{dateStr}</div>}
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* COLLABORATORS */}
      {on('collaborators') && collabsShow.length > 0 && (
        <section style={{ padding: '80px 0', background: WHITE }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 56px' }}>
            <FadeUp>
              <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Colaboradores</p>
              <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 40 }}>Proveedores de confianza</h2>
            </FadeUp>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 1, background: LINE, border: `1px solid ${LINE}` }}>
              {collabsShow.map((c: any, i: number) => (
                <FadeUp key={i} delay={(i % 4) * .04}>
                  <div style={{ background: WHITE, padding: '22px 24px', height: '100%' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: primary, marginBottom: 8 }}>{c.category}</div>
                    <div style={{ fontFamily: font, fontSize: 18, color: INK, marginBottom: 4 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{c.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AGENDAR VISITA */}
      {on('schedule_visit') && (() => {
        const sv = (sec as any).schedule_visit ?? {}
        const svUrl   = sv.url
        const svTitle = sv.title    || 'Visitadnos en persona'
        const svSub   = sv.subtitle || 'Ven a conocer el espacio, sin compromiso. Nuestro equipo estará encantado de enseñaros el venue.'
        const svCta   = sv.cta_label || 'Reservar visita gratuita →'
        return (
          <section style={{ padding: '96px 0', background: GRAY, textAlign: 'center' }}>
            <FadeUp>
              <div style={{ maxWidth: 540, margin: '0 auto', padding: '0 32px' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: `${primary}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <p style={{ fontSize: '.65rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 12 }}>Visita</p>
                <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: 20 }}>{svTitle}</h2>
                <p style={{ fontSize: '.95rem', color: MUTED, lineHeight: 1.7, marginBottom: 40 }}>{svSub}</p>
                {visitDone ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: `${primary}14`, border: `1px solid ${primary}33`, borderRadius: 8, padding: '14px 28px', fontSize: '.88rem', color: primary, fontWeight: 600 }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ¡Solicitud enviada! Os confirmaremos la visita pronto.
                  </div>
                ) : svUrl ? (
                  <a href={svUrl} target="_blank" rel="noopener"
                    style={{ display: 'inline-block', background: primary, color: darkPri ? '#fff' : '#111', padding: '16px 40px', borderRadius: 4, fontSize: '.9rem', fontWeight: 700, textDecoration: 'none', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {svCta}
                  </a>
                ) : (
                  <button onClick={() => setVisitModalOpen(true)}
                    style={{ background: primary, color: darkPri ? '#fff' : '#111', padding: '16px 40px', borderRadius: 4, fontSize: '.9rem', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                    {svCta}
                  </button>
                )}
                {sv.note && <p style={{ fontSize: '.78rem', color: MUTED, marginTop: 16 }}>{sv.note}</p>}
              </div>
            </FadeUp>
          </section>
        )
      })()}

      {visitModalOpen && (
        <VisitBookingModal
          proposalId={data.id}
          coupleName={data.couple_name}
          primaryColor={primary}
          selectedSpaces={[]}
          onClose={() => setVisitModalOpen(false)}
          onSuccess={() => { setVisitModalOpen(false); setVisitDone(true) }}
        />
      )}

      {/* MAPA */}
      {on('map') && (sec.map_embed_url || (data.venueContent.map_info as any)?.embed_url) && (() => {
        const embed = sec.map_embed_url || (data.venueContent.map_info as any).embed_url
        const address = sec.map_address || (data.venueContent.map_info as any)?.address
        return (
          <section style={{ padding: '80px 0', background: OFF }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 56px' }}>
              <FadeUp>
                <p style={{ fontSize: '.68rem', fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>Ubicación</p>
                <h2 style={{ fontFamily: font, fontSize: 'clamp(2rem,3.5vw,3rem)', color: INK, lineHeight: 1.15, marginBottom: address ? 10 : 32 }}>Cómo llegar</h2>
                {address && <p style={{ fontSize: 14, color: MUTED, marginBottom: 32 }}>{address}</p>}
              </FadeUp>
              <FadeUp delay={.1}>
                <div style={{ overflow: 'hidden', border: `1px solid ${LINE}` }}>
                  <iframe src={embed} width="100%" height="360" style={{ border: 'none', display: 'block' }} loading="lazy" allowFullScreen />
                </div>
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* CTA — contacto directo */}
      <section className="t5-cta-section" id="t5-cta">
        <div className="t5-cta-inner">
          <div className="t5-cta-top">
            <FadeUp>
              <h2 className="t5-cta-heading">
                ¿Tenéis<br />alguna <span>duda?</span>
              </h2>
              <p className="t5-cta-desc">
                Escribidnos por WhatsApp o email para cualquier consulta sobre la propuesta o el menú. Respondemos en menos de 24 horas.
              </p>
              <div className="t5-cta-bullets">
                <div className="t5-cta-bullet"><span className="t5-cta-bullet-text">Respuesta en menos de 24 horas</span></div>
                <div className="t5-cta-bullet"><span className="t5-cta-bullet-text">Asesoramiento personalizado</span></div>
              </div>
            </FadeUp>
            {contactOn && (
              <FadeUp delay={0.15}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
                  {contact.phone && (
                    <a href={`https://wa.me/${contact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, me ha llegado la propuesta para ${data.couple_name}.`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 44px', background: '#25D366', color: '#fff', border: 'none', fontSize: '.88rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
                      <IcoChat width={16} height={16} /> WhatsApp
                    </a>
                  )}
                  {contact.email && (
                    <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Propuesta ${data.couple_name}`)}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '18px 44px', background: primary, color: darkPri ? '#fff' : INK, border: 'none', fontSize: '.88rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', textDecoration: 'none' }}>
                      Enviar email
                    </a>
                  )}
                </div>
              </FadeUp>
            )}
          </div>
        </div>
      {/* ── FLOATING WHATSAPP ── */}
      {contactOn && <FloatingWhatsApp phone={contact.phone} coupleName={data.couple_name} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />}

        <div className="t5-footer-wrap">
          {branding?.logo_url
            ? <img src={branding.logo_url} className="t5-footer-logo" alt={venueName} />
            : <span style={{ fontFamily: font, fontSize: '.95rem', color: MUTED }}>{venueName}</span>
          }
          <span className="t5-footer-text">Propuesta generada exclusivamente para {data.couple_name}</span>
          <div className="t5-footer-links">
            {data.venue?.website && <a href={data.venue.website} target="_blank" rel="noopener">Web</a>}
            {data.venue?.contact_email && <a href={`mailto:${data.venue.contact_email}`}>Email</a>}
            {data.venue?.contact_phone && <a href={`tel:${data.venue.contact_phone}`}>Teléfono</a>}
          </div>
        </div>
      </section>
    </div>
  )
}
