'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import {
  ArrowRight, Globe, Clock, CheckCircle2, Zap, Bell,
  MapPin, Users, Image as ImageIcon, AlertCircle, FileText,
  TrendingUp, Calendar,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WvsSnapshot {
  venueName: string
  location: string
  heroImageUrl: string | null
  capacity: string
  status: string | null        // onboarding status: draft | submitted | approved
  changesStatus: string | null // changes_status: draft | submitted | null
  galleryCount: number
  hasDescription: boolean
  leadsTotal: number
  leadsThisMonth: number
  lastLeadAt: string | null
  publicUrl: string | null
}

// ── Status helpers ─────────────────────────────────────────────────────────────

function fichaStatusInfo(status: string | null, changesStatus: string | null) {
  if (changesStatus === 'submitted') return { label: 'Cambios en revisión', color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  if (changesStatus === 'draft')    return { label: 'Cambios en borrador',  color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' }
  if (status === 'approved')        return { label: 'Publicada',            color: '#16a34a', bg: '#f0fdf4', border: '#86efac' }
  if (status === 'submitted')       return { label: 'En revisión',          color: '#d97706', bg: '#fffbeb', border: '#fde68a' }
  if (status === 'draft')           return { label: 'Borrador',             color: '#64748b', bg: '#f8fafc', border: '#cbd5e1' }
  return { label: 'Sin ficha',      color: '#dc2626', bg: '#fef2f2', border: '#fecaca' }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  if (d < 7)  return `Hace ${d} días`
  if (d < 30) return `Hace ${Math.floor(d / 7)} semanas`
  return `Hace ${Math.floor(d / 30)} meses`
}

// ── Completion score ────────────────────────────────────────────────────────────

function completionScore(snap: WvsSnapshot) {
  const checks = [
    !!snap.venueName,
    !!snap.location,
    !!snap.heroImageUrl,
    !!snap.capacity,
    snap.hasDescription,
    snap.galleryCount >= 3,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ── WVS Active Card ─────────────────────────────────────────────────────────────

function WvsCard({ snap, loading }: { snap: WvsSnapshot | null; loading: boolean }) {
  const statusInfo = fichaStatusInfo(snap?.status ?? null, snap?.changesStatus ?? null)
  const score = snap ? completionScore(snap) : 0

  return (
    <Link href="/canales/weddingvenuesspain" style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(10,22,40,0.06)',
          cursor: 'pointer',
          transition: 'box-shadow 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(10,22,40,0.11)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(10,22,40,0.06)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        }}
      >
        {/* Top bar: hero + venue info */}
        <div style={{ display: 'flex', alignItems: 'stretch', minHeight: 110 }}>
          {/* Hero thumbnail */}
          <div style={{ width: 140, flexShrink: 0, background: '#f1f5f9', position: 'relative', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ width: '100%', height: '100%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImageIcon size={20} style={{ color: '#94a3b8' }} />
              </div>
            ) : snap?.heroImageUrl ? (
              <img src={snap.heroImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f8fafc' }}>
                <ImageIcon size={20} style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', padding: '0 8px' }}>Sin foto principal</span>
              </div>
            )}
          </div>

          {/* Venue info */}
          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, color: 'var(--espresso)', lineHeight: 1.2 }}>WeddingVenuesSpain.com</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 500, marginTop: 1 }}>Bodas · España</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(22,163,74,0.10)', color: '#15803d', border: '1px solid rgba(22,163,74,0.25)' }}>
                    ACTIVO
                  </span>
                  {!loading && snap?.publicUrl && (
                    <a
                      href={snap.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: '#2E6DB4', textDecoration: 'none', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(46,109,180,0.25)', background: 'rgba(46,109,180,0.06)', whiteSpace: 'nowrap' }}
                    >
                      <Globe size={10} /> Ver ficha pública
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#2E6DB4' }}>
                  Gestionar <ArrowRight size={12} />
                </div>
              </div>

              {/* Venue name + location */}
              {loading ? (
                <div style={{ height: 16, background: '#e2e8f0', borderRadius: 6, width: '60%', marginBottom: 6 }} />
              ) : (
                <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--espresso)', marginBottom: 4 }}>
                  {snap?.venueName || <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 13 }}>Nombre no configurado</span>}
                </div>
              )}
              {!loading && snap?.location && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                  <MapPin size={11} />
                  {snap.location}
                </div>
              )}
            </div>

            {/* Status + capacity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {!loading && (
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.border}` }}>
                  {statusInfo.label}
                </span>
              )}
              {!loading && snap?.capacity && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warm-gray)' }}>
                  <Users size={10} />
                  {snap.capacity} invitados
                </div>
              )}
              {!loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warm-gray)' }}>
                  <ImageIcon size={10} />
                  {snap?.galleryCount ?? 0} fotos
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: '#fafafa' }}>
          {[
            {
              icon: <TrendingUp size={13} style={{ color: '#2E6DB4' }} />,
              label: 'Leads totales',
              value: loading ? '—' : String(snap?.leadsTotal ?? 0),
              sub: null,
            },
            {
              icon: <Calendar size={13} style={{ color: '#7c3aed' }} />,
              label: 'Este mes',
              value: loading ? '—' : String(snap?.leadsThisMonth ?? 0),
              sub: null,
            },
            {
              icon: <Clock size={13} style={{ color: '#d97706' }} />,
              label: 'Último lead',
              value: loading ? '—' : (snap?.lastLeadAt ? timeAgo(snap.lastLeadAt) : '—'),
              sub: null,
            },
            {
              icon: <FileText size={13} style={{ color: score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#dc2626' }} />,
              label: 'Ficha completa',
              value: loading ? '—' : `${score}%`,
              sub: null,
            },
          ].map((stat, i, arr) => (
            <div key={i} style={{
              padding: '11px 16px',
              borderRight: i < arr.length - 1 ? '1px solid rgba(0,0,0,0.07)' : 'none',
              display: 'flex', flexDirection: 'column', gap: 3,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {stat.icon}
                <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 500 }}>{stat.label}</span>
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 17, fontWeight: 700, color: 'var(--espresso)', lineHeight: 1 }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Completion warning if low */}
        {!loading && score < 80 && (
          <div style={{ padding: '9px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#92400e' }}>
              Tu ficha no está completa — complétala para mejorar tu visibilidad en WeddingVenuesSpain.com
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CanalesPage() {
  const { user, profile, activeVenue } = useAuth()
  const [snap, setSnap]       = useState<WvsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const supabase = createClient()

      // Onboarding / ficha data
      let onbQ = supabase.from('venue_onboarding').select('ficha_data, status, changes_status, changes_data').eq('user_id', user.id)
      if (activeVenue?.id) onbQ = onbQ.eq('venue_id', activeVenue.id)
      const { data: onb } = await onbQ.maybeSingle()

      const ficha = onb?.changes_data ?? onb?.ficha_data ?? {}

      // Leads from WVS
      let leadsQ = supabase.from('leads').select('id, created_at', { count: 'exact' })
        .eq('user_id', user.id).eq('source', 'wedding_venues_spain')
      if (activeVenue?.id) leadsQ = leadsQ.eq('venue_id', activeVenue.id)
      const { data: leadsData, count: leadsTotal } = await leadsQ.order('created_at', { ascending: false })

      const startOfMonth = new Date()
      startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
      const leadsThisMonth = (leadsData ?? []).filter(l => new Date(l.created_at) >= startOfMonth).length
      const lastLeadAt = leadsData?.[0]?.created_at ?? null

      // WP public URL
      const wpVenueId = activeVenue?.wp_venue_id ?? profile?.wp_venue_id
      let publicUrl: string | null = null
      if (wpVenueId) {
        const res = await fetch(`/api/venues/wp-venue?id=${wpVenueId}`).catch(() => null)
        if (res?.ok) {
          const wpData = await res.json().catch(() => null)
          publicUrl = wpData?.link ?? null
        }
      }

      setSnap({
        venueName:     ficha.H1_Venue || '',
        location:      ficha.location || '',
        heroImageUrl:  ficha.heroImageUrl || null,
        capacity:      ficha.capacity || '',
        status:        onb?.status ?? null,
        changesStatus: onb?.changes_status ?? null,
        galleryCount:  Array.isArray(ficha.gallery) ? ficha.gallery.filter(Boolean).length : 0,
        hasDescription: !!(ficha.postContent || ficha.miniParagraph),
        leadsTotal:    leadsTotal ?? 0,
        leadsThisMonth,
        lastLeadAt,
        publicUrl,
      })
      setLoading(false)
    })()
  }, [user?.id, activeVenue?.id]) // eslint-disable-line

  const soonChannels = [
    { name: 'Bodas.net',  tagline: 'Bodas · España & LATAM',   description: 'Directorio de bodas con presencia en más de 15 países hispanohablantes. Millones de parejas cada mes.', logoLetter: 'B', accentColor: '#c026a0', accentBg: '#FDF4FF', reach: '+15 países' },
    { name: 'Zankyou',    tagline: 'Bodas · Internacional',     description: 'Plataforma global de bodas con alcance en Europa, América y Asia. Ideal para venues de alto nivel.',       logoLetter: 'Z', accentColor: '#6366f1', accentBg: '#EEF2FF', reach: 'Internacional' },
    { name: 'Tagvenue',   tagline: 'Eventos · Internacional',   description: 'Marketplace para alquiler de espacios en eventos corporativos, fiestas y reuniones de empresa.',           logoLetter: 'T', accentColor: '#0891b2', accentBg: '#ECFEFF', reach: 'Internacional' },
  ]

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="topbar">
          <div className="topbar-title">Canales de venta</div>
        </div>
        <div className="page-content" style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* Intro */}
          <div style={{ fontSize: 13, color: 'var(--warm-gray)', lineHeight: 1.6, marginBottom: 28 }}>
            Gestiona tu presencia en los principales portales de bodas y eventos. Cada canal conecta tu venue con miles de parejas.
          </div>

          {/* Active section */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <CheckCircle2 size={14} style={{ color: '#16a34a' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Activos
              </span>
            </div>
            <WvsCard snap={snap} loading={loading} />
          </div>

          {/* Coming soon */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Clock size={14} style={{ color: 'var(--warm-gray)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Próximamente
              </span>
              <span style={{ fontSize: 11, color: 'var(--warm-gray)', marginLeft: 2 }}>({soonChannels.length})</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {soonChannels.map(ch => (
                <div key={ch.name} style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 14, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `${ch.accentColor}35`, borderRadius: '14px 14px 0 0' }} />

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: ch.accentBg, border: `1px solid ${ch.accentColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 16, color: ch.accentColor }}>{ch.logoLetter}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13.5, color: 'var(--espresso)', lineHeight: 1.2 }}>{ch.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{ch.tagline}</div>
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: 'var(--cream)', color: 'var(--warm-gray)', border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>Próx.</span>
                  </div>

                  <p style={{ fontSize: 12.5, color: 'var(--warm-gray)', lineHeight: 1.5, margin: '0 0 14px' }}>{ch.description}</p>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warm-gray)' }}>
                      <Globe size={11} />{ch.reach}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--warm-gray)' }}>
                      <Bell size={11} />Notificarme
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer tip */}
          <div style={{ marginTop: 32, padding: '14px 18px', borderRadius: 12, background: 'rgba(46,109,180,0.05)', border: '1px solid rgba(46,109,180,0.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={14} style={{ color: '#2E6DB4', flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
              Cada nuevo canal que integremos aparecerá aquí automáticamente en tu portal.
            </span>
          </div>

        </div>
      </div>
    </div>
  )
}
