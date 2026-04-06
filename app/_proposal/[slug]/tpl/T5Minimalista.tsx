'use client'
// T5 — Minimalista / Urgencia
// Post-visita: el cliente ya conoce el espacio. Sin relleno. Decisión rápida.
// Diseño: blanco puro + un único color primario muy presente + tipografía grande

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
import {
  extractData, formatDate, formatPrice, isDark, toRgb,
  getEmbedUrl, FadeUp, FadeIn,
  ConversionBlock, FloatingWhatsApp, AvailabilityBanner,
} from './shared'

// ─── Palette ──────────────────────────────────────────────────────────────────
const WHITE = '#FFFFFF'
const OFF   = '#F9F9F7'
const GRAY  = '#F2F2F0'
const INK   = '#111111'
const MUTED = '#888888'
const LINE  = '#E8E8E8'

// ─── CSS ──────────────────────────────────────────────────────────────────────
const buildCss = (pri: string, priRgb: string, darkPri: boolean) => `
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
    font-family: 'DM Serif Display', serif; font-size: clamp(2.8rem, 5vw, 4.4rem);
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
    font-family: 'DM Serif Display', serif; font-size: 1.8rem; color: ${INK};
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
    font-family: 'DM Serif Display', serif;
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
    gap: 2px;
  }
  .t5-inc-item {
    padding: 28px 24px;
    background: rgba(${darkPri ? '255,255,255' : '0,0,0'},.06);
    transition: background .2s;
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
    font-family: 'DM Serif Display', serif; font-size: clamp(2rem, 4vw, 3rem);
    color: ${INK}; line-height: 1.15; margin-bottom: 48px;
  }
  .t5-receipt {
    background: ${WHITE}; border: 1px solid ${LINE};
  }
  .t5-receipt-header {
    background: ${INK}; color: #fff;
    padding: 20px 32px; display: flex; justify-content: space-between; align-items: center;
  }
  .t5-receipt-header-venue { font-family: 'DM Serif Display', serif; font-size: 1.1rem }
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
    font-family: 'DM Serif Display', serif;
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
  .t5-pkg-title { font-family: 'DM Serif Display', serif; font-size: clamp(2rem, 3.5vw, 3rem); color: ${INK}; margin-bottom: 56px }
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
    font-size: .62rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: ${pri}; margin-bottom: 10px; display: block;
  }
  .t5-pkg.recommended .t5-pkg-badge { color: ${pri} }
  .t5-pkg-name {
    font-family: 'DM Serif Display', serif; font-size: 1.4rem;
    color: ${INK}; margin-bottom: 6px;
  }
  .t5-pkg.recommended .t5-pkg-name { color: #fff }
  .t5-pkg-sub { font-size: .8rem; color: ${MUTED}; margin-bottom: 20px }
  .t5-pkg.recommended .t5-pkg-sub { color: rgba(255,255,255,.5) }
  .t5-pkg-price {
    font-family: 'DM Serif Display', serif; font-size: 2.6rem;
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
    font-family: 'DM Serif Display', serif; font-style: italic;
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
    font-family: 'DM Serif Display', serif; font-size: 1.2rem;
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
  const { sec, on, packagesShow, inclusionsShow, expShow, faqShow } = extractData(data)

  const branding  = data.branding
  const primary   = branding?.primary_color || '#1A1A1A'
  const priRgb    = toRgb(primary)
  const darkPri   = isDark(primary)
  const venueName = data.venue?.name || ''
  const photos    = data.venue?.photo_urls || []
  const heroPhoto = photos[0] || ''

  const heroImgRef = useRef<HTMLImageElement>(null)
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

  const [form, setForm]         = useState({ name: '', email: '', phone: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [faqOpen, setFaqOpen]   = useState<number | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { createClient } = await import('@/lib/supabase')
      const sb = createClient()
      await sb.from('proposal_contacts').insert({ proposal_id: data.id, ...form })
    } catch {}
    setSubmitted(true)
  }

  const activePkgs = packagesShow.filter((p: any) => p.is_active !== false)

  return (
    <div className="t5">
      <style dangerouslySetInnerHTML={{ __html: buildCss(primary, priRgb, darkPri) }} />

      {/* SCROLL PROGRESS */}
      <div className="t5-progress" style={{ width: `${progress}%` }} />

      {/* NAV */}
      <nav className={`t5-nav ${scrolled ? 'scrolled' : ''}`}>
        {branding?.logo_url
          ? <img src={branding.logo_url} className="t5-logo" alt={venueName} />
          : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem' }}>{venueName}</span>
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
          <button className="t5-nav-cta" onClick={() => document.getElementById('t5-cta')?.scrollIntoView({ behavior: 'smooth' })}>
            Reservar
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
              <button className="t5-hero-btn-primary" onClick={() => document.getElementById('t5-cta')?.scrollIntoView({ behavior: 'smooth' })}>
                Confirmar fecha <span>→</span>
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
      {sec.show_availability_msg && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />
      )}

      {/* URGENCY BAR */}
      {data.show_availability && (
        <div className="t5-urgency">
          <div className="t5-urgency-dot" />
          <p className="t5-urgency-text">
            <strong>Fecha disponible</strong> — Las fechas de temporada alta se agotan rápido. Reserva con prioridad.
          </p>
          <button className="t5-urgency-cta" onClick={() => document.getElementById('t5-cta')?.scrollIntoView({ behavior: 'smooth' })}>
            Asegurar fecha
          </button>
        </div>
      )}

      {/* ── CONVERSION BLOCK ── */}
      <ConversionBlock data={data} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} dark={false} ctaId="t5-cta" />

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
                    <span className="t5-inc-emoji">{inc.emoji || '✦'}</span>
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
                        <div className="t5-receipt-row-name">{inc.emoji} {inc.title}</div>
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
                    {pkg.is_recommended && <span className="t5-pkg-badge">★ Más elegido</span>}
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
                      onClick={() => {
                        setForm(p => ({ ...p, message: `Me interesa el paquete: ${pkg.name}` }))
                        document.getElementById('t5-cta')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                    >
                      Elegir este paquete
                    </button>
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
              <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: INK, marginBottom: 40 }}>Preguntas frecuentes</h2>
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

      {/* CTA — la más prominente */}
      <section className="t5-cta-section" id="t5-cta">
        <div className="t5-cta-inner">
          <div className="t5-cta-top">
            <FadeUp>
              <h2 className="t5-cta-heading">
                Vuestra fecha<br />está <span>esperando</span>
              </h2>
              <p className="t5-cta-desc">
                Ya conocéis el espacio. Solo falta confirmar vuestra fecha y empezar a planificar juntos el día más importante de vuestra vida.
              </p>
              <div className="t5-cta-bullets">
                <div className="t5-cta-bullet"><span className="t5-cta-bullet-text">Respuesta en menos de 24 horas</span></div>
                <div className="t5-cta-bullet"><span className="t5-cta-bullet-text">Sin compromiso inicial</span></div>
                <div className="t5-cta-bullet"><span className="t5-cta-bullet-text">Asesoramiento personalizado incluido</span></div>
              </div>
            </FadeUp>
            <FadeUp delay={0.15}>
              {submitted ? (
                <div style={{ border: `1px solid ${LINE}`, padding: '64px 40px', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: 20 }}>✓</div>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.6rem', color: INK, marginBottom: 12 }}>
                    ¡Solicitud recibida!
                  </h3>
                  <p style={{ fontSize: '.9rem', color: MUTED, lineHeight: 1.7 }}>
                    Os contactaremos en menos de 24 horas para confirmar todos los detalles.
                  </p>
                </div>
              ) : (
                <form className="t5-form" onSubmit={handleSubmit}>
                  <div className="t5-form-title">Solicitar disponibilidad</div>
                  <div className="t5-form-body">
                    <div className="t5-form-row">
                      <label className="t5-form-label">Vuestros nombres</label>
                      <input className="t5-form-input" placeholder={data.couple_name} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                    </div>
                    <div className="t5-form-row">
                      <label className="t5-form-label">Email de contacto</label>
                      <input className="t5-form-input" type="email" placeholder="hola@ejemplo.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                    </div>
                    <div className="t5-form-row">
                      <label className="t5-form-label">Teléfono</label>
                      <input className="t5-form-input" placeholder="+34 600 000 000" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="t5-form-row">
                      <label className="t5-form-label">¿Algo más que quieras contarnos?</label>
                      <textarea className="t5-form-input t5-form-textarea" placeholder="Número de invitados, fecha preferida, preguntas…" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
                    </div>
                    <button type="submit" className="t5-form-submit">
                      Confirmar interés <span>→</span>
                    </button>
                  </div>
                </form>
              )}
            </FadeUp>
          </div>
        </div>
      {/* ── FLOATING WHATSAPP ── */}
      <FloatingWhatsApp phone={data.venue?.contact_phone || ''} coupleName={data.couple_name} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />

        <div className="t5-footer-wrap">
          {branding?.logo_url
            ? <img src={branding.logo_url} className="t5-footer-logo" alt={venueName} />
            : <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '.95rem', color: MUTED }}>{venueName}</span>
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
