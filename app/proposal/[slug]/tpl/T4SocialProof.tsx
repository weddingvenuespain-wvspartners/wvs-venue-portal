'use client'
// T4 — Social Proof
// Confianza primero: estadísticas → testimonios → galería con nombres → oferta
// Tono: cálido, amber/terracotta, muchas bodas celebradas

import { useEffect, useRef, useState } from 'react'
import type { ProposalData } from '../page'
import {
  extractData, formatDate, formatPrice, isDark, toRgb,
  FadeUp, FadeIn, useReveal,
  FloatingWhatsApp, AvailabilityBanner, Gallery,
  IcoCalendar, IcoUsers, IcoBuilding, IcoChat,
  formatZoneCapacities, formatZoneFeatures, ivaLabel,
  InclusionIcon, StarRating, resolveContact, VenueRentalGrid,
} from './shared'
import { buildSingleFontUrl } from '@/lib/fonts'
import { WeddingProposal } from './WeddingProposal'

// ─── Palette ──────────────────────────────────────────────────────────────────
const CREAM  = '#FFFAF4'
const WARM   = '#FFF2E6'
const SAND   = '#F5E6D3'
const TERRA  = '#C9714A'
const CLAY   = '#8B4A2F'
const MUTED  = '#9C7B6A'
const INK    = '#2A1F1A'

// ─── CSS ──────────────────────────────────────────────────────────────────────
const buildCss = (pri: string, priRgb: string, darkPri: boolean, font: string) => `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }

  .t4 {
    font-family: 'Inter', sans-serif;
    background: ${CREAM};
    color: ${INK};
    overflow-x: hidden;
  }

  /* ── Nav ── */
  .t4-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 40px; height: 64px;
    background: rgba(255,250,244,0);
    transition: background .4s, box-shadow .4s;
  }
  .t4-nav.scrolled {
    background: rgba(255,250,244,.97);
    box-shadow: 0 1px 0 rgba(0,0,0,.06);
  }
  .t4-logo { height: 34px; width: auto; object-fit: contain }
  .t4-nav-cta {
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    border: none; padding: 9px 22px; font-size: .8rem; font-weight: 600;
    letter-spacing: .06em; text-transform: uppercase; cursor: pointer;
    border-radius: 2px; transition: opacity .2s;
  }
  .t4-nav-cta:hover { opacity: .85 }

  /* ── First screen wrapper: hero + stats fit in exactly 100vh ── */
  .t4-first-screen {
    min-height: 100vh; display: flex; flex-direction: column;
  }
  /* ── Hero ── */
  .t4-hero {
    position: relative; flex: 1 1 auto; min-height: 520px;
    overflow: hidden; display: flex; align-items: flex-end;
  }
  .t4-hero-img {
    position: absolute; inset: 0; width: 100%; height: 120%;
    object-fit: cover; object-position: center;
    transform-origin: center bottom;
  }
  .t4-hero-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.2) 60%, rgba(0,0,0,.1) 100%);
  }
  .t4-hero-content {
    position: relative; z-index: 2;
    padding: 60px 60px 72px;
    max-width: 760px;
  }
  .t4-hero-couple {
    font-family: ${font}; font-weight: 400; font-style: italic;
    font-size: clamp(3rem, 7vw, 5.5rem);
    color: #fff; line-height: 1.05;
    text-shadow: 0 2px 30px rgba(0,0,0,.3);
  }
  .t4-hero-meta {
    margin-top: 20px; display: flex; gap: 24px; flex-wrap: wrap;
  }
  .t4-hero-pill {
    background: rgba(255,255,255,.15); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,.2);
    color: #fff; padding: 6px 16px;
    font-size: .78rem; font-weight: 500; letter-spacing: .04em;
    border-radius: 50px;
  }
  .t4-hero-pill.pri-pill {
    background: rgba(${priRgb},.9);
    border-color: transparent;
    color: ${darkPri ? '#fff' : INK};
  }

  /* ── Stats Bar ── */
  .t4-stats {
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    display: flex; justify-content: center; flex-wrap: wrap;
    gap: 0; overflow: hidden;
  }
  .t4-stat {
    display: flex; flex-direction: column; align-items: center;
    padding: 18px 44px; gap: 4px;
    border-right: 1px solid rgba(${darkPri ? '255,255,255' : '0,0,0'},.15);
  }
  .t4-stat:last-child { border-right: none }
  .t4-stat-num {
    font-family: ${font}; font-weight: 600;
    font-size: 1.9rem; line-height: 1;
  }
  .t4-stat-lbl {
    font-size: .72rem; font-weight: 500; letter-spacing: .08em;
    text-transform: uppercase; opacity: .75;
  }

  /* ── Section shells ── */
  .t4-section { padding: 88px 0 }
  .t4-inner { max-width: 1180px; margin: 0 auto; padding: 0 48px }
  .t4-section-head { text-align: center; margin-bottom: 48px }
  .t4-section-label {
    display: block; text-align: center;
    font-size: .68rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: ${TERRA}; margin-bottom: 12px;
  }
  .t4-section-title {
    font-family: ${font}; font-weight: 400;
    font-size: clamp(1.8rem, 3.5vw, 2.8rem);
    color: ${INK}; line-height: 1.2; margin-bottom: 10px;
    text-align: center;
  }
  .t4-section-sub {
    font-size: .93rem; color: ${MUTED}; line-height: 1.7; max-width: 560px; margin: 0 auto;
  }
  .t4-divider {
    width: 48px; height: 2px; background: ${pri}; margin: 18px auto 0;
  }

  /* ── Testimonials ── */
  .t4-tests-bg { background: ${WARM} }
  .t4-tests-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 24px; margin-top: 48px;
  }
  .t4-test-card {
    background: #fff; border-radius: 4px;
    padding: 36px 32px 28px;
    position: relative; overflow: hidden;
    box-shadow: 0 2px 20px rgba(${toRgb(TERRA)},.07);
    display: flex; flex-direction: column; gap: 20px;
    border-bottom: 3px solid ${pri};
  }
  .t4-test-quote-mark {
    font-family: ${font};
    font-size: 7rem; line-height: 0.6;
    color: ${pri}; opacity: .15;
    position: absolute; top: 16px; left: 24px;
    pointer-events: none; user-select: none;
  }
  .t4-test-stars {
    display: flex; gap: 3px; color: #F5A623;
    font-size: .9rem;
  }
  .t4-test-text {
    font-family: ${font}; font-style: italic;
    font-size: 1.02rem; line-height: 1.75; color: ${INK};
    position: relative; z-index: 1;
  }
  .t4-test-footer {
    display: flex; align-items: center; gap: 14px;
    padding-top: 16px; border-top: 1px solid ${SAND};
  }
  .t4-test-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    object-fit: cover; flex-shrink: 0;
    border: 2px solid ${SAND};
  }
  .t4-test-avatar-ph {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(135deg, ${pri}, ${TERRA});
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-family: ${font}; color: #fff;
    font-size: 1.1rem; font-weight: 600;
  }
  .t4-test-couple { font-weight: 600; font-size: .88rem; color: ${INK} }
  .t4-test-date { font-size: .77rem; color: ${MUTED} }

  /* ── Gallery con captions ── */
  .t4-gallery-bg { background: ${INK} }
  .t4-gallery-header { padding: 72px 48px 40px; max-width: 1100px; margin: 0 auto }
  .t4-gallery-header .t4-section-label { color: rgba(255,255,255,.5) }
  .t4-gallery-header .t4-section-title { color: #fff }
  .t4-gallery-header .t4-divider { background: ${pri} }
  .t4-gallery-strip {
    display: grid;
    grid-template-columns: 2fr 1.5fr 1fr 1.5fr;
    gap: 3px; overflow: hidden;
  }
  .t4-gallery-item {
    position: relative; overflow: hidden; cursor: pointer;
    aspect-ratio: 3/4;
  }
  .t4-gallery-item:first-child { aspect-ratio: 3/5 }
  .t4-gallery-item img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .6s cubic-bezier(.22,1,.36,1);
  }
  .t4-gallery-item:hover img { transform: scale(1.05) }
  .t4-gallery-caption {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 40px 18px 16px;
    background: linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 100%);
    color: #fff; opacity: 0;
    transition: opacity .3s;
  }
  .t4-gallery-item:hover .t4-gallery-caption { opacity: 1 }
  .t4-gallery-caption-name {
    font-family: ${font}; font-style: italic;
    font-size: .9rem; font-weight: 600;
  }
  .t4-gallery-caption-date { font-size: .72rem; opacity: .75; margin-top: 2px }

  /* ── Personal message ── */
  .t4-msg-bg { background: ${CREAM} }
  .t4-msg-wrap {
    max-width: 720px; margin: 0 auto; text-align: center; padding: 80px 48px;
  }
  .t4-msg-icon { font-size: 2rem; margin-bottom: 20px }
  .t4-msg-title {
    font-family: ${font}; font-size: 1.6rem;
    color: ${INK}; margin-bottom: 20px;
  }
  .t4-msg-text {
    font-size: 1.02rem; line-height: 1.85; color: ${MUTED};
    white-space: pre-wrap;
  }

  /* ── Experience / Info ── */
  .t4-exp-bg { background: ${SAND} }
  .t4-exp-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 0; align-items: stretch;
  }
  .t4-exp-text {
    padding: 72px 56px;
  }
  .t4-exp-body {
    font-size: .96rem; line-height: 1.85; color: ${MUTED}; margin-top: 8px;
  }
  .t4-exp-img-wrap {
    overflow: hidden; min-height: 420px;
  }
  .t4-exp-img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform .7s ease;
  }
  .t4-exp-img-wrap:hover .t4-exp-img { transform: scale(1.04) }

  /* ── Packages ── */
  .t4-packages-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(300px,1fr));
    gap: 20px; margin-top: 48px;
  }
  .t4-pkg {
    background: #fff; border-radius: 4px;
    padding: 32px 28px;
    box-shadow: 0 2px 20px rgba(0,0,0,.05);
    position: relative; overflow: hidden;
    border-top: 3px solid ${SAND};
    transition: box-shadow .3s, transform .3s;
  }
  .t4-pkg.recommended {
    border-top-color: ${pri};
    box-shadow: 0 8px 40px rgba(${priRgb},.18);
  }
  .t4-pkg:hover { transform: translateY(-3px); box-shadow: 0 8px 32px rgba(0,0,0,.1) }
  .t4-pkg-badge {
    position: absolute; top: 0; right: 24px;
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    font-size: .65rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    padding: 4px 12px; border-radius: 0 0 4px 4px;
  }
  .t4-pkg-name {
    font-family: ${font}; font-size: 1.3rem;
    color: ${INK}; margin-bottom: 6px;
  }
  .t4-pkg-sub { font-size: .82rem; color: ${MUTED}; margin-bottom: 18px }
  .t4-pkg-price {
    font-family: ${font}; font-size: 2.2rem;
    font-weight: 600; color: ${pri}; line-height: 1;
    margin-bottom: 20px;
  }
  .t4-pkg-price span { font-size: 1rem; color: ${MUTED}; font-weight: 400 }
  .t4-pkg-includes {
    list-style: none; display: flex; flex-direction: column; gap: 8px;
  }
  .t4-pkg-includes li {
    font-size: .83rem; color: ${MUTED}; display: flex; align-items: baseline; gap: 8px;
  }
  .t4-pkg-includes li::before {
    content: '✓'; color: ${pri}; font-weight: 700; flex-shrink: 0;
  }
  .t4-pkg-guests {
    margin-top: 16px; padding-top: 14px;
    border-top: 1px solid ${SAND};
    font-size: .78rem; color: ${MUTED};
  }

  /* ── Inclusions grid ── */
  .t4-inclusions-bg { background: ${WARM} }
  .t4-inc-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr));
    gap: 16px; margin-top: 48px; align-items: stretch;
  }
  .t4-inc-grid > * { height: 100% }
  .t4-inc-item {
    background: #fff; border-radius: 4px;
    padding: 24px 20px; text-align: center;
    box-shadow: 0 1px 12px rgba(0,0,0,.05);
    transition: transform .25s, box-shadow .25s;
    height: 100%; display: flex; flex-direction: column; align-items: center;
  }
  .t4-inc-item:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(0,0,0,.08) }
  .t4-inc-emoji { font-size: 1.8rem; display: block; margin-bottom: 10px }
  .t4-inc-title { font-size: .84rem; font-weight: 600; color: ${INK} }
  .t4-inc-desc { font-size: .77rem; color: ${MUTED}; margin-top: 5px; line-height: 1.5 }

  /* ── Zones ── */
  .t4-zones { display: flex; flex-direction: column; gap: 32px; margin-top: 48px }
  .t4-zone {
    display: grid; grid-template-columns: 1fr 1fr;
    background: #fff; border-radius: 4px; overflow: hidden;
    box-shadow: 0 2px 16px rgba(0,0,0,.05);
  }
  .t4-zone:nth-child(even) .t4-zone-img-wrap { order: 2 }
  .t4-zone:nth-child(even) .t4-zone-info { order: 1 }
  .t4-zone-img-wrap { overflow: hidden; min-height: 260px }
  .t4-zone-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .6s ease }
  .t4-zone-img-wrap:hover .t4-zone-img { transform: scale(1.05) }
  .t4-zone-ph {
    width: 100%; height: 100%; min-height: 260px;
    background: linear-gradient(135deg, ${SAND}, ${WARM});
    display: flex; align-items: center; justify-content: center;
    font-size: 3rem;
  }
  .t4-zone-info { padding: 36px 32px; display: flex; flex-direction: column; gap: 10px }
  .t4-zone-name { font-family: ${font}; font-size: 1.4rem; color: ${INK} }
  .t4-zone-desc { font-size: .87rem; color: ${MUTED}; line-height: 1.7 }
  .t4-zone-cap { font-size: .8rem; color: ${TERRA}; font-weight: 600 }
  .t4-zone-price { font-size: .9rem; font-weight: 600; color: ${INK} }

  /* ── FAQ ── */
  .t4-faq-bg { background: ${CREAM} }
  .t4-faq-list { margin-top: 48px; display: flex; flex-direction: column; gap: 2px }
  .t4-faq-item {
    background: #fff; border-radius: 3px;
    overflow: hidden;
    box-shadow: 0 1px 8px rgba(0,0,0,.04);
  }
  .t4-faq-q {
    width: 100%; padding: 20px 24px;
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    background: none; border: none; cursor: pointer; text-align: left;
    font-size: .93rem; font-weight: 600; color: ${INK};
    transition: background .2s;
  }
  .t4-faq-q:hover { background: ${WARM} }
  .t4-faq-q.open { color: ${pri} }
  .t4-faq-chevron {
    width: 20px; height: 20px; flex-shrink: 0;
    border-right: 2px solid currentColor; border-bottom: 2px solid currentColor;
    transform: rotate(45deg); transition: transform .3s, color .2s;
    margin-top: -4px;
  }
  .t4-faq-chevron.open { transform: rotate(-135deg); margin-top: 4px }
  .t4-faq-a {
    overflow: hidden; transition: max-height .4s cubic-bezier(.4,0,.2,1);
    max-height: 0;
  }
  .t4-faq-a-inner { padding: 0 24px 20px; font-size: .88rem; color: ${MUTED}; line-height: 1.75 }

  /* ── CTA section ── */
  .t4-cta-bg {
    background: linear-gradient(135deg, ${INK} 0%, ${CLAY} 100%);
    position: relative; overflow: hidden;
  }
  .t4-cta-bg::before {
    content: ''; position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .t4-cta-inner {
    position: relative; z-index: 1;
    display: grid; grid-template-columns: 1fr 1fr;
    align-items: center; gap: 64px;
    max-width: 1100px; margin: 0 auto;
    padding: 100px 48px;
  }
  .t4-cta-left {}
  .t4-cta-headline {
    font-family: ${font}; font-style: italic;
    font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 400;
    color: #fff; line-height: 1.2; margin-bottom: 20px;
  }
  .t4-cta-sub { font-size: .93rem; color: rgba(255,255,255,.65); line-height: 1.7 }
  .t4-cta-social-proof {
    margin-top: 32px; display: flex; align-items: center; gap: 12px;
  }
  .t4-cta-avatars { display: flex }
  .t4-cta-av {
    width: 36px; height: 36px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,.3);
    background: linear-gradient(135deg, ${pri}, ${TERRA});
    margin-left: -8px; display: flex; align-items: center; justify-content: center;
    font-size: .7rem; color: #fff; font-weight: 600;
    overflow: hidden;
  }
  .t4-cta-av:first-child { margin-left: 0 }
  .t4-cta-av img { width: 100%; height: 100%; object-fit: cover }
  .t4-cta-proof-text { font-size: .8rem; color: rgba(255,255,255,.65) }
  .t4-cta-proof-text strong { color: #fff; font-weight: 600 }

  .t4-form {
    background: rgba(255,255,255,.06); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px; padding: 40px 36px;
    display: flex; flex-direction: column; gap: 16px;
  }
  .t4-form-title {
    font-family: ${font};
    font-size: 1.2rem; color: #fff; margin-bottom: 8px;
    text-align: center;
  }
  .t4-form-field { display: flex; flex-direction: column; gap: 6px }
  .t4-form-label { font-size: .72rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.5) }
  .t4-form-input {
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15);
    border-radius: 3px; padding: 12px 16px;
    color: #fff; font-size: .9rem; font-family: 'Inter', sans-serif;
    outline: none; transition: border-color .2s, background .2s;
  }
  .t4-form-input::placeholder { color: rgba(255,255,255,.3) }
  .t4-form-input:focus { border-color: ${pri}; background: rgba(255,255,255,.12) }
  .t4-form-textarea { resize: vertical; min-height: 90px }
  .t4-form-btn {
    background: ${pri}; color: ${darkPri ? '#fff' : INK};
    border: none; padding: 15px 32px; font-size: .85rem;
    font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
    cursor: pointer; border-radius: 3px; margin-top: 8px;
    transition: opacity .2s, transform .2s;
  }
  .t4-form-btn:hover { opacity: .9; transform: translateY(-1px) }

  /* ── Footer ── */
  .t4-footer {
    background: ${INK}; padding: 40px 48px;
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
  }
  .t4-footer-logo { height: 28px; object-fit: contain; opacity: .7 }
  .t4-footer-links { display: flex; gap: 20px }
  .t4-footer-links a { font-size: .78rem; color: rgba(255,255,255,.4); text-decoration: none; transition: color .2s }
  .t4-footer-links a:hover { color: rgba(255,255,255,.7) }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .t4-hero-content { padding: 40px 28px 56px }
    .t4-inner { padding: 0 24px }
    .t4-section { padding: 64px 0 }
    .t4-exp-grid { grid-template-columns: 1fr }
    .t4-exp-img-wrap { min-height: 280px }
    .t4-zone { grid-template-columns: 1fr }
    .t4-zone:nth-child(even) .t4-zone-img-wrap { order: 0 }
    .t4-zone:nth-child(even) .t4-zone-info { order: 0 }
    .t4-cta-inner { grid-template-columns: 1fr; padding: 64px 24px }
    .t4-gallery-strip { grid-template-columns: 1fr 1fr }
    .t4-gallery-item { aspect-ratio: 1/1 }
    .t4-gallery-item:first-child { aspect-ratio: 1/1 }
    .t4-footer { flex-direction: column; align-items: flex-start }
    .t4-stat { padding: 18px 24px }
  }
  @media (max-width: 540px) {
    .t4-tests-grid { grid-template-columns: 1fr }
    .t4-nav { padding: 0 20px }
    .t4-gallery-strip { grid-template-columns: 1fr }
    .t4-packages-grid { grid-template-columns: 1fr }
    .t4-inc-grid { grid-template-columns: 1fr 1fr }
  }
`

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatsBar({ count, primary, darkPri }: { count: number; primary: string; darkPri: boolean }) {
  const stats = [
    { num: `${count}+`, lbl: 'Bodas celebradas' },
    { num: '4.9', lbl: 'Valoración media', isRating: true },
    { num: '12+', lbl: 'Años de experiencia' },
    { num: '98%', lbl: 'Recomendarían el espacio' },
  ]
  return (
    <div className="t4-stats">
      {stats.map((s: any, i: number) => (
        <div key={i} className="t4-stat">
          <span className="t4-stat-num" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
            {s.num}
            {s.isRating && <StarRating rating={5} size={14} color="currentColor" />}
          </span>
          <span className="t4-stat-lbl">{s.lbl}</span>
        </div>
      ))}
    </div>
  )
}

function TestCard({ t, i }: { t: any; i: number }) {
  const { ref, vis } = useReveal()
  const initials = (t.couple_name || t.names || '??').split(/[\s&+y]/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join('')
  return (
    <div ref={ref} className="t4-test-card" style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(24px)', transition: `opacity .6s ${i * .1}s ease, transform .6s ${i * .1}s ease` }}>
      <div className="t4-test-quote-mark">"</div>
      <div className="t4-test-stars"><StarRating rating={t.rating ?? 5} size={16} color="#F5A623" /></div>
      <p className="t4-test-text">"{t.text}"</p>
      <div className="t4-test-footer">
        {t.photo_url
          ? <img src={t.photo_url} className="t4-test-avatar" alt={t.couple_name || t.names} />
          : <div className="t4-test-avatar-ph">{initials}</div>
        }
        <div>
          <div className="t4-test-couple">{t.couple_name || t.names}</div>
          {(t.wedding_date || t.date) && <div className="t4-test-date">{t.wedding_date || t.date}</div>}
        </div>
      </div>
    </div>
  )
}

function FaqItem({ q, a, idx }: { q: string; a: string; idx: number }) {
  const [open, setOpen] = useState(false)
  return (
    <FadeUp delay={idx * .05}>
      <div className="t4-faq-item">
        <button className={`t4-faq-q ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
          {q}
          <div className={`t4-faq-chevron ${open ? 'open' : ''}`} />
        </button>
        <div className="t4-faq-a" style={{ maxHeight: open ? '400px' : '0' }}>
          <div className="t4-faq-a-inner">{a}</div>
        </div>
      </div>
    </FadeUp>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function T4SocialProof({ data }: { data: ProposalData }) {
  const { sec, on, hasCatering, packagesShow, zonesShow, inclusionsShow, faqShow, expShow, testsShow, menuShow, menusStructured, menuExtras, appetizersBase, seasonsShow, collabsShow, extrasShow, accom } = extractData(data)

  const branding  = data.branding
  const primary   = branding?.primary_color || TERRA
  const priRgb    = toRgb(primary)
  const darkPri   = isDark(primary)
  const font      = (branding as any)?.font_family || "'Playfair Display', Georgia, serif"
  const venueName = data.venue?.name || ''
  const contact   = resolveContact(data)
  const contactOn = on('contact') && (contact.phone || contact.email)
  const photos    = data.venue?.photo_urls || []
  const secData   = (data as any).sections_data || {}

  const heroImgRef = useRef<HTMLImageElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 60)
      if (heroImgRef.current) heroImgRef.current.style.transform = `translateY(${y * 0.25}px)`
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

  const testCount = testsShow.length
  const heroPhoto = secData.hero_image_url || photos[0] || ''
  const galleryPhotos = secData.gallery_urls?.length ? secData.gallery_urls : photos.slice(0, 8)
  const photoCount = galleryPhotos.length

  // Build gallery items with couple names from testimonials
  const galleryItems: { url: string; coupleName: string | null; weddingDate: string | null }[] = galleryPhotos.map((url: string, i: number) => ({
    url,
    coupleName: testsShow[i]?.couple_name || testsShow[i]?.names || null,
    weddingDate: testsShow[i]?.wedding_date || testsShow[i]?.date || null,
  }))

  return (
    <div className="t4">
      <style dangerouslySetInnerHTML={{ __html: buildCss(primary, priRgb, darkPri, font) }} />

      {/* NAV */}
      <nav className={`t4-nav ${scrolled ? 'scrolled' : ''}`}>
        {branding?.logo_url
          ? <img src={branding.logo_url} className="t4-logo" alt={venueName} />
          : <span style={{ fontFamily: font, fontSize: '1.1rem', fontWeight: 600, color: scrolled ? INK : '#fff' }}>{venueName}</span>
        }
        <button className="t4-nav-cta" onClick={() => (document.getElementById(hasCatering ? 'menu' : 't4-cta') ?? document.getElementById('t4-cta'))?.scrollIntoView({ behavior: 'smooth' })}>
          {hasCatering ? 'Ver menús' : 'Contactar'}
        </button>
      </nav>

      {/* FIRST SCREEN — hero + stats lock to 100vh */}
      <div className="t4-first-screen">
        <section className="t4-hero">
          {heroPhoto && <img ref={heroImgRef} src={heroPhoto} className="t4-hero-img" alt={venueName} />}
          <div className="t4-hero-overlay" />
          <div className="t4-hero-content">
            <FadeIn>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '.72rem', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: primary, marginBottom: 14 }}>
                Propuesta exclusiva para
              </p>
              <h1 className="t4-hero-couple">{data.couple_name}</h1>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="t4-hero-meta">
                {data.wedding_date && (
                  <span className="t4-hero-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoCalendar width={12} height={12} /> {formatDate(data.wedding_date)}</span>
                )}
                {data.guest_count && (
                  <span className="t4-hero-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoUsers width={12} height={12} /> {data.guest_count} invitados</span>
                )}
                {data.show_price_estimate && data.price_estimate && (
                  <span className="t4-hero-pill pri-pill">Desde {formatPrice(data.price_estimate)}{ivaLabel(sec, true) ? ` · ${ivaLabel(sec, true)}` : ''}</span>
                )}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* STATS BAR — part of first screen */}
        <StatsBar count={Math.max(testCount * 3, 47)} primary={primary} darkPri={darkPri} />
      </div>

      {/* ── AVAILABILITY BANNER ── */}
      {on('availability') && sec.availability_message && (
        <AvailabilityBanner message={sec.availability_message} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />
      )}

      {/* TESTIMONIALS — first content section */}
      {testsShow.length > 0 && on('testimonials') && (
        <section className="t4-section t4-tests-bg">
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Lo que dicen las parejas</span>
              <h2 className="t4-section-title">Historias reales de amor</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div className="t4-tests-grid">
              {testsShow.map((t: any, i: number) => (
                <TestCard key={i} t={t} i={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* GALLERY */}
      {galleryPhotos.length > 0 && on('gallery') && (
        <section className="t4-gallery-bg">
          <div className="t4-gallery-header">
            <FadeUp>
              <span className="t4-section-label">Bodas en este espacio</span>
              <h2 className="t4-section-title" style={{ color: '#fff' }}>Momentos que nos han confiado</h2>
              <div className="t4-divider" />
            </FadeUp>
          </div>
          <Gallery photos={galleryPhotos} primary={primary} dark />
        </section>
      )}

      {/* PERSONAL MESSAGE */}
      {on('welcome') && data.personal_message && (
        <section className="t4-msg-bg">
          <FadeUp>
            <div className="t4-msg-wrap">
              <div className="t4-msg-icon">💌</div>
              <h2 className="t4-msg-title">Un mensaje para vosotros</h2>
              <p className="t4-msg-text">{data.personal_message}</p>
            </div>
          </FadeUp>
        </section>
      )}

      {/* EXPERIENCE */}
      {expShow && on('experience') && (
        <section className="t4-exp-bg">
          <div className="t4-exp-grid">
            <FadeUp>
              <div className="t4-exp-text">
                <span className="t4-section-label">La experiencia</span>
                <h2 className="t4-section-title">{expShow.title}</h2>
                <div className="t4-divider" />
                <p className="t4-exp-body">{expShow.body}</p>
              </div>
            </FadeUp>
            {photos[1] && (
              <div className="t4-exp-img-wrap">
                <img src={photos[1]} className="t4-exp-img" alt="El espacio" loading="lazy" />
              </div>
            )}
          </div>
        </section>
      )}

      {/* INCLUSIONS */}
      {inclusionsShow.length > 0 && on('inclusions') && (
        <section className="t4-section t4-inclusions-bg">
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Qué está incluido</span>
              <h2 className="t4-section-title">Todo lo que necesitáis</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div className="t4-inc-grid">
              {inclusionsShow.map((inc: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div className="t4-inc-item">
                    <span className="t4-inc-emoji" style={{ display: 'inline-flex', color: primary }}>
                      <InclusionIcon name={inc.icon || inc.emoji || 'check'} size={28} color={primary} strokeWidth={1.5} />
                    </span>
                    <div className="t4-inc-title">{inc.title}</div>
                    {inc.description && <div className="t4-inc-desc">{inc.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PACKAGES */}
      {packagesShow.length > 0 && on('packages') && (
        <section className="t4-section">
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Paquetes y precios</span>
              <h2 className="t4-section-title">Adaptado a vuestra boda</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div className="t4-packages-grid">
              {packagesShow.filter((p: any) => p.is_active !== false).map((pkg: any, i: number) => (
                <FadeUp key={i} delay={i * .1}>
                  <div className={`t4-pkg ${pkg.is_recommended ? 'recommended' : ''}`}>
                    {pkg.is_recommended && <div className="t4-pkg-badge">Más elegido</div>}
                    <div className="t4-pkg-name">{pkg.name}</div>
                    {pkg.subtitle && <div className="t4-pkg-sub">{pkg.subtitle}</div>}
                    {pkg.price && (
                      <div className="t4-pkg-price">
                        {pkg.price} <span>por persona</span>
                      </div>
                    )}
                    {pkg.includes?.length > 0 && (
                      <ul className="t4-pkg-includes">
                        {pkg.includes.map((inc: string, j: number) => (
                          <li key={j}>{inc}</li>
                        ))}
                      </ul>
                    )}
                    {(pkg.min_guests || pkg.max_guests) && (
                      <div className="t4-pkg-guests">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoUsers width={11} height={11} /> {pkg.min_guests && `${pkg.min_guests}`}{pkg.min_guests && pkg.max_guests && '–'}{pkg.max_guests && `${pkg.max_guests}`} invitados</span>
                      </div>
                    )}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ZONES */}
      {zonesShow.length > 0 && on('zones') && (
        <section className="t4-section" style={{ background: WARM }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Los espacios</span>
              <h2 className="t4-section-title">Cada rincón, una historia</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div className="t4-zones">
              {zonesShow.map((z: any, i: number) => {
                const zPhoto = z.photos?.[0] || photos[i + 2]
                const caps = formatZoneCapacities(z)
                const feats = formatZoneFeatures(z)
                return (
                  <FadeUp key={i} delay={0.1}>
                    <div className="t4-zone">
                      <div className="t4-zone-img-wrap">
                        {zPhoto
                          ? <img src={zPhoto} className="t4-zone-img" alt={z.name} loading="lazy" />
                          : <div className="t4-zone-ph"><IcoBuilding width={48} height={48} style={{ opacity: .3, color: '#fff' }} /></div>
                        }
                      </div>
                      <div className="t4-zone-info">
                        <div className="t4-zone-name">{z.name}</div>
                        {z.description && <div className="t4-zone-desc">{z.description}</div>}
                        {caps.length > 0 && (
                          <div className="t4-zone-cap" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {caps.map((c, ci) => (
                              <span key={ci} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IcoUsers width={11} height={11} /> {c}</span>
                            ))}
                          </div>
                        )}
                        {feats.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                            {feats.map((f, fi) => (
                              <span key={fi} style={{ fontSize: '.7rem', padding: '3px 9px', border: `1px solid rgba(${priRgb},.25)`, borderRadius: 999, color: primary, letterSpacing: '.03em' }}>{f}</span>
                            ))}
                          </div>
                        )}
                        {z.notes && <div style={{ fontSize: '.76rem', color: MUTED, marginTop: 6, fontStyle: 'italic' }}>{z.notes}</div>}
                        {z.price && <div className="t4-zone-price">{z.price}</div>}
                      </div>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* VENUE RENTAL — grid temporada × día */}
      {on('venue_rental') && sec.venue_rental?.rows && sec.venue_rental.rows.length > 0 && (
        <section className="t4-section" style={{ background: CREAM }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">{sec.venue_rental.title || 'Tarifas de alquiler'}</span>
              <h2 className="t4-section-title">Elegid vuestra fecha</h2>
              <div className="t4-divider" />
            </FadeUp>
            <FadeUp delay={.1}>
              <div style={{ marginTop: 40 }}>
                <VenueRentalGrid data={sec.venue_rental} primary={primary} />
              </div>
            </FadeUp>
          </div>
        </section>
      )}

      {/* SEASON PRICES */}
      {on('season_prices') && seasonsShow.length > 0 && (
        <section className="t4-section" style={{ background: SAND }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Tarifas por temporada</span>
              <h2 className="t4-section-title">Precios según la fecha</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div style={{ marginTop: 40, background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
              {seasonsShow.map((s: any, i: number) => (
                <FadeUp key={i} delay={i * .05}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 16, alignItems: 'center', padding: '20px 28px', borderBottom: i < seasonsShow.length - 1 ? `1px solid ${SAND}` : 'none' }}>
                    <div style={{ fontFamily: font, fontSize: 18, color: INK }}>{s.label || s.season}</div>
                    <div>
                      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: primary, marginBottom: 3 }}>{s.date_range}</div>
                      {s.notes && <div style={{ fontSize: 12, color: MUTED }}>{s.notes}</div>}
                    </div>
                    <div style={{ fontFamily: font, fontSize: 20, fontWeight: 600, color: primary, textAlign: 'right', whiteSpace: 'nowrap' }}>{s.price_modifier}</div>
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
        <section className="t4-section" style={{ background: CREAM }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Alojamiento</span>
              <h2 className="t4-section-title">Quedaos a dormir</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32, alignItems: 'start' }}>
              <FadeUp>
                <div>
                  {accom.description && <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, color: MUTED, lineHeight: 1.85, marginBottom: 16 }}>{accom.description}</p>}
                  {accom.rooms && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {accom.rooms.split('·').map((r: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'Inter,sans-serif', fontSize: 14, color: INK }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: primary, flexShrink: 0 }} />{r.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FadeUp>
              <FadeUp delay={.1}>
                {Array.isArray(accom.options) && accom.options.length > 0 ? (
                  <div style={{ background: '#fff', borderRadius: 4, padding: 24, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 2px 20px rgba(0,0,0,.04)' }}>
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
                  <div style={{ background: '#fff', borderRadius: 4, padding: 24, boxShadow: '0 2px 20px rgba(0,0,0,.04)' }}>
                    <p style={{ fontSize: 14, color: INK, lineHeight: 1.8 }}>{accom.price_info}</p>
                  </div>
                ) : null}
                {accom.nearby && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${SAND}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: TERRA, marginBottom: 6 }}>Alojamientos cercanos</div>
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
        <section className="t4-section" style={{ background: WARM }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Personaliza</span>
              <h2 className="t4-section-title">Servicios adicionales</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div style={{ marginTop: 40, background: '#fff', borderRadius: 4, overflow: 'hidden' }}>
              {extrasShow.map((svc: any, i: number) => (
                <FadeUp key={i} delay={i * .04}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: i < extrasShow.length - 1 ? `1px solid ${SAND}` : 'none', gap: 20 }}>
                    <div>
                      <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 15, fontWeight: 500, color: INK }}>{svc.name}</div>
                      {svc.description && <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{svc.description}</div>}
                    </div>
                    {svc.price && <span style={{ fontFamily: font, fontSize: 20, fontWeight: 600, color: primary, whiteSpace: 'nowrap' }}>{svc.price}</span>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* COLLABORATORS */}
      {on('collaborators') && collabsShow.length > 0 && (
        <section className="t4-section" style={{ background: CREAM }}>
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Proveedores de confianza</span>
              <h2 className="t4-section-title">Nuestros colaboradores</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {collabsShow.map((c: any, i: number) => (
                <FadeUp key={i} delay={(i % 4) * .04}>
                  <div style={{ background: '#fff', borderRadius: 4, padding: '20px 22px', boxShadow: '0 1px 12px rgba(0,0,0,.04)', height: '100%' }}>
                    <div style={{ fontFamily: 'Inter,sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: TERRA, marginBottom: 8 }}>{c.category}</div>
                    <div style={{ fontFamily: font, fontSize: 18, color: INK, marginBottom: 4 }}>{c.name}</div>
                    {c.description && <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55 }}>{c.description}</div>}
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {faqShow.length > 0 && on('faq') && (
        <section className="t4-section t4-faq-bg">
          <div className="t4-inner">
            <FadeUp>
              <span className="t4-section-label">Preguntas frecuentes</span>
              <h2 className="t4-section-title">Resolvemos vuestras dudas</h2>
              <div className="t4-divider" />
            </FadeUp>
            <div className="t4-faq-list">
              {faqShow.map((f: any, i: number) => (
                <FaqItem key={i} q={f.question} a={f.answer} idx={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* MAPA */}
      {on('map') && (sec.map_embed_url || (data.venueContent.map_info as any)?.embed_url) && (() => {
        const embed = sec.map_embed_url || (data.venueContent.map_info as any).embed_url
        const address = sec.map_address || (data.venueContent.map_info as any)?.address
        return (
          <section className="t4-section" style={{ background: SAND }}>
            <div className="t4-inner">
              <FadeUp>
                <span className="t4-section-label">Ubicación</span>
                <h2 className="t4-section-title">Cómo llegar</h2>
                <div className="t4-divider" />
                {address && <p style={{ textAlign: 'center', fontSize: 14, color: MUTED, marginTop: 18 }}>{address}</p>}
              </FadeUp>
              <FadeUp delay={.1}>
                <div style={{ marginTop: 40, overflow: 'hidden', borderRadius: 4, boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
                  <iframe src={embed} width="100%" height="380" style={{ border: 'none', display: 'block' }} loading="lazy" allowFullScreen />
                </div>
              </FadeUp>
            </div>
          </section>
        )
      })()}

      {/* CTA — social proof + contact */}
      <section className="t4-cta-bg" id="t4-cta">
        <div className="t4-cta-inner">
          <FadeUp>
            <div className="t4-cta-left">
              <h2 className="t4-cta-headline">
                Más de {Math.max(testCount * 3, 47)} parejas ya confiaron en nosotros
              </h2>
              <p className="t4-cta-sub">
                ¿Tenéis dudas sobre la propuesta o el menú? Escribidnos por WhatsApp o email y os respondemos en menos de 24 horas.
              </p>
              {testsShow.length > 0 && (
                <div className="t4-cta-social-proof">
                  <div className="t4-cta-avatars">
                    {testsShow.slice(0, 4).map((t: any, i: number) => (
                      <div key={i} className="t4-cta-av">
                        {t.photo_url
                          ? <img src={t.photo_url} alt={t.couple_name} />
                          : (t.couple_name || t.names || '?')[0]?.toUpperCase()
                        }
                      </div>
                    ))}
                  </div>
                  <p className="t4-cta-proof-text">
                    <strong>{testsShow.length} parejas</strong> comparten su experiencia
                  </p>
                </div>
              )}
            </div>
          </FadeUp>
          {contactOn && (
            <FadeUp delay={0.2}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'stretch', minWidth: 280 }}>
                {contact.phone && (
                  <a href={`https://wa.me/${contact.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola, he visto la propuesta para ${data.couple_name} y me gustaría hablar con vosotros.`)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, textDecoration: 'none' }}>
                    <IcoChat width={22} height={22} style={{ flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>Escríbenos por WhatsApp</div>
                      <div style={{ fontSize: 12, opacity: .9, marginTop: 2 }}>{contact.phone}</div>
                    </div>
                  </a>
                )}
                {contact.email && (
                  <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Propuesta ${data.couple_name}`)}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: primary, color: darkPri ? '#fff' : INK, border: 'none', borderRadius: 8, textDecoration: 'none' }}>
                    <InclusionIcon name="mail" size={22} color={darkPri ? '#fff' : INK} strokeWidth={1.8} />
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }}>Escríbenos por email</div>
                      <div style={{ fontSize: 12, opacity: .85, marginTop: 2, wordBreak: 'break-all' }}>{contact.email}</div>
                    </div>
                  </a>
                )}
              </div>
            </FadeUp>
          )}
        </div>
      </section>

      {/* FOOTER */}
      {/* ── FLOATING WHATSAPP ── */}
      {contactOn && <FloatingWhatsApp phone={contact.phone} coupleName={data.couple_name} primary={primary} onPrimary={darkPri ? '#fff' : '#111'} />}

      <footer className="t4-footer">
        {branding?.logo_url
          ? <img src={branding.logo_url} className="t4-footer-logo" alt={venueName} />
          : <span style={{ fontFamily: font, fontSize: '1rem', color: 'rgba(255,255,255,.5)' }}>{venueName}</span>
        }
        <div className="t4-footer-links">
          {data.venue?.website && <a href={data.venue.website} target="_blank" rel="noopener">Web</a>}
          {data.venue?.contact_email && <a href={`mailto:${data.venue.contact_email}`}>Email</a>}
          {data.venue?.contact_phone && <a href={`tel:${data.venue.contact_phone}`}>Teléfono</a>}
        </div>
      </footer>
    </div>
  )
}
