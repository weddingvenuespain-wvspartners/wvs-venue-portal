'use client'
// T6 — Alojamiento (boutique hotel style)
// Dossier dedicado SOLO a alojamiento. Hero editorial + selector habitaciones + servicios + contacto.
// No incluye secciones de evento (zonas, modalidades, menú, etc.) — diseñado para propuestas hoteleras puras.

import { useEffect, useState } from 'react'
import type { ProposalData } from '../page'
import LodgingSection from '../LodgingSection'
import { MapPin, Calendar as CalendarIcon, Star } from 'lucide-react'

const T6_FONT = "'Cormorant Garamond', 'EB Garamond', serif"
const T6_SANS = "'DM Sans', 'Inter', sans-serif"

export default function T6Alojamiento({ data }: { data: ProposalData }) {
  const sd = (data as any).sections_data ?? {}
  const lodging = (data as any).lodging
  const branding = data.branding ?? { primary_color: '#2D4A3A', font_family: T6_FONT }
  const primary = (branding as any).primary_color ?? '#2D4A3A'
  const secondary = (branding as any).secondary_color ?? '#8FAA94'
  const venue = data.venue
  const heroPhoto = venue?.photo_urls?.[0] ?? sd.hero_image_url ?? null

  // Smooth scroll behaviour
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth'
    return () => { document.documentElement.style.scrollBehavior = '' }
  }, [])

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0 }
    .t6 { font-family: ${T6_SANS}; background: #FBFAF7; color: #1A1A1A; min-height: 100vh; overflow-x: hidden }
    .t6 h1, .t6 h2, .t6 h3 { font-family: ${branding.font_family ?? T6_FONT}; font-weight: 500; line-height: 1.1; letter-spacing: -.01em }

    /* Hero */
    .t6-hero { position: relative; min-height: 88vh; display: flex; align-items: flex-end; padding: 60px 40px; overflow: hidden }
    .t6-hero::before {
      content: ''; position: absolute; inset: 0; background: ${heroPhoto ? `url(${heroPhoto}) center/cover` : `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`};
      z-index: 0;
    }
    .t6-hero::after {
      content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.65) 0%, rgba(0,0,0,.25) 50%, rgba(0,0,0,0) 100%);
      z-index: 1;
    }
    .t6-hero-content { position: relative; z-index: 2; max-width: 960px; margin: 0 auto; width: 100%; color: #fff }
    .t6-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: .72rem; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.85); margin-bottom: 18px }
    .t6-eyebrow::before { content: ''; width: 28px; height: 1px; background: rgba(255,255,255,.6) }
    .t6-title { font-size: clamp(2.4rem, 5.5vw, 4.2rem); margin-bottom: 16px; color: #fff }
    .t6-couple { font-size: clamp(1rem, 1.5vw, 1.2rem); color: rgba(255,255,255,.9); font-weight: 400; margin-bottom: 10px; letter-spacing: .03em }
    .t6-venue-meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: .82rem; color: rgba(255,255,255,.8); margin-top: 28px }
    .t6-venue-meta span { display: flex; align-items: center; gap: 6px }

    /* Intro band */
    .t6-intro { background: #fff; padding: 50px 40px; border-bottom: 1px solid #ECE7DD }
    .t6-intro-inner { max-width: 760px; margin: 0 auto; text-align: center }
    .t6-intro h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); color: ${primary}; margin-bottom: 14px }
    .t6-intro p { font-size: 1rem; line-height: 1.7; color: #4A4A4A }

    /* Stats strip (optional) */
    .t6-stats { display: flex; justify-content: center; gap: 60px; padding: 28px 40px; background: #F5F0E8; border-bottom: 1px solid #ECE7DD; flex-wrap: wrap }
    .t6-stat { text-align: center }
    .t6-stat-num { font-family: ${T6_FONT}; font-size: 1.8rem; color: ${primary}; font-weight: 600; line-height: 1 }
    .t6-stat-label { font-size: .68rem; font-weight: 600; letter-spacing: .15em; text-transform: uppercase; color: #888; margin-top: 6px }

    /* Sections */
    .t6-section { padding: 70px 40px }
    .t6-section-inner { max-width: 960px; margin: 0 auto }
    .t6-section h2 { font-size: clamp(1.8rem, 3vw, 2.4rem); color: ${primary}; margin-bottom: 8px }
    .t6-section-sub { font-size: .95rem; color: #777; margin-bottom: 28px }

    /* Override lodging colors via vars */
    .t6 #lodging { background: #fff; padding: 70px 20px }
    .t6 #lodging h2 { color: ${primary}; font-family: ${branding.font_family ?? T6_FONT} }

    /* FAQ */
    .t6-faq-item { padding: 18px 0; border-bottom: 1px solid #ECE7DD }
    .t6-faq-item:last-child { border-bottom: none }
    .t6-faq-q { font-weight: 600; color: ${primary}; margin-bottom: 6px; font-size: 1.05rem }
    .t6-faq-a { color: #555; line-height: 1.6; font-size: .95rem }

    /* Map */
    .t6-map-card { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.06); display: grid; grid-template-columns: 1fr 1fr; align-items: stretch; min-height: 280px }
    .t6-map-info { padding: 28px; display: flex; flex-direction: column; gap: 14px; justify-content: center }
    .t6-map-info h3 { font-size: 1.4rem; color: ${primary} }
    .t6-map-iframe { width: 100%; height: 100%; min-height: 280px; border: 0 }
    @media (max-width: 720px) { .t6-map-card { grid-template-columns: 1fr } }


    /* Footer */
    .t6-footer { text-align: center; padding: 28px 20px; font-size: .75rem; color: #999; background: #FBFAF7 }
  `

  const formatWeddingDate = (iso: string | null | undefined) => {
    if (!iso) return null
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return null }
  }

  const stayDate = formatWeddingDate(data.wedding_date)
  const faqs = (data.venueContent?.faq ?? []).slice(0, 6)
  const mapInfo = data.venueContent?.map_info

  return (
    <div className="t6 tpl-root">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* Hero */}
      <section className="t6-hero" id="hero">
        <div className="t6-hero-content">
          <div className="t6-eyebrow">Propuesta de alojamiento</div>
          <h1 className="t6-title">{venue?.name ?? 'Tu estancia exclusiva'}</h1>
          {data.couple_name && <div className="t6-couple">Para {data.couple_name}</div>}
          <div className="t6-venue-meta">
            {venue?.city && <span><MapPin size={14} /> {venue.city}{venue.region ? `, ${venue.region}` : ''}</span>}
            {stayDate && <span><CalendarIcon size={14} /> {stayDate}</span>}
            {data.guest_count && <span><Star size={14} /> {data.guest_count} {data.guest_count === 1 ? 'persona' : 'personas'}</span>}
          </div>
        </div>
      </section>

      {/* Intro / personal message */}
      {data.personal_message && (
        <section className="t6-intro">
          <div className="t6-intro-inner">
            <h2>Bienvenidos</h2>
            <p>{data.personal_message}</p>
          </div>
        </section>
      )}

      {/* Stats strip — pulls from lodging data */}
      {lodging && lodging.room_types && lodging.room_types.length > 0 && (
        <div className="t6-stats">
          <div className="t6-stat">
            <div className="t6-stat-num">{lodging.room_types.length}</div>
            <div className="t6-stat-label">Tipos de habitación</div>
          </div>
          <div className="t6-stat">
            <div className="t6-stat-num">{lodging.room_types.reduce((s: number, r: any) => s + r.total_quantity, 0)}</div>
            <div className="t6-stat-label">Habitaciones</div>
          </div>
          <div className="t6-stat">
            <div className="t6-stat-num">{lodging.room_types.reduce((s: number, r: any) => s + r.capacity_persons * r.total_quantity, 0)}</div>
            <div className="t6-stat-label">Capacidad total</div>
          </div>
        </div>
      )}

      {/* Lodging selector (the core of T6) */}
      {lodging && lodging.room_types && lodging.room_types.length > 0 && (
        <LodgingSection data={lodging} proposalId={data.id} isPreview={(data as any)._preview} />
      )}

      {/* FAQ */}
      {faqs.length > 0 && (
        <section className="t6-section" id="faq" style={{ background: '#F5F0E8' }}>
          <div className="t6-section-inner">
            <h2>Preguntas frecuentes</h2>
            <p className="t6-section-sub">Todo lo que necesitas saber sobre tu estancia</p>
            <div>
              {faqs.map(q => (
                <div key={q.id} className="t6-faq-item">
                  <div className="t6-faq-q">{q.question}</div>
                  <div className="t6-faq-a">{q.answer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Map */}
      {(mapInfo?.embed_url || mapInfo?.address) && (
        <section className="t6-section" id="map">
          <div className="t6-section-inner">
            <h2>Cómo llegar</h2>
            <p className="t6-section-sub">Localización y accesos</p>
            <div className="t6-map-card">
              <div className="t6-map-info">
                <h3>{venue?.name}</h3>
                {mapInfo.address && <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#555', fontSize: '.95rem', lineHeight: 1.5 }}><MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {mapInfo.address}</div>}
                {mapInfo.notes && <div style={{ color: '#777', fontSize: '.88rem', lineHeight: 1.5 }}>{mapInfo.notes}</div>}
              </div>
              {mapInfo.embed_url ? (
                <iframe src={mapInfo.embed_url} className="t6-map-iframe" loading="lazy" />
              ) : (
                <div style={{ background: '#ECE7DD', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Sin mapa</div>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="t6-footer">Generado con FOREVENTOS · {venue?.name ?? ''}</footer>
    </div>
  )
}
