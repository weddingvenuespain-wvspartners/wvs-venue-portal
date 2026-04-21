'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Heart, MapPin, MessageSquare, Check, Building2, UtensilsCrossed, Lock, X, ChevronLeft, ChevronRight, Users, FileText, ExternalLink } from 'lucide-react'

/* ─── Status pill ────────────────────────────────────────────── */
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Pendiente',     color: '#9c8f88', bg: 'rgba(156,143,136,0.12)' },
  requested:   { label: 'Solicitado',   color: '#c4975a', bg: 'rgba(196,151,90,0.15)'  },
  available:   { label: 'Disponible',   color: '#16a34a', bg: 'rgba(22,163,74,0.12)'   },
  unavailable: { label: 'No disponible',color: '#dc2626', bg: 'rgba(220,38,38,0.12)'   },
}
function StatusPill({ status, light }: { status: string; light?: boolean }) {
  const m = STATUS_META[status] || STATUS_META.pending
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700,
      padding: '4px 11px', borderRadius: 20, letterSpacing: '0.03em',
      color: light ? '#fff' : m.color,
      background: light ? 'rgba(255,255,255,0.22)' : m.bg,
      backdropFilter: light ? 'blur(8px)' : 'none',
      border: light ? '1px solid rgba(255,255,255,0.35)' : 'none',
    }}>
      {m.label}
    </span>
  )
}

/* ─── Countdown hook ─────────────────────────────────────────── */
function useCountdown(dateStr: string | null) {
  const [t, setT] = useState<{ d: number; h: number; m: number; s: number; expired: boolean } | null>(null)
  useEffect(() => {
    if (!dateStr) return
    const target = new Date(dateStr).getTime()
    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) {
        setT({ d: 0, h: 0, m: 0, s: 0, expired: true })
        return
      }
      setT({ d: Math.floor(diff / 86400000), h: Math.floor((diff % 86400000) / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000), expired: false })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [dateStr])
  return t
}

/* ─── Beautiful venue modal ──────────────────────────────────── */
function VenueModal({ venue, onClose }: { venue: any; onClose: () => void }) {
  const [idx, setIdx] = useState(0)
  const vp = venue.venue_prof || {}
  const imgs: string[] = [venue.hero_image, ...(venue.gallery || []).map((g: any) => g?.url || g)].filter(Boolean)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft'  && imgs.length > 1) setIdx(i => (i - 1 + imgs.length) % imgs.length)
      if (e.key === 'ArrowRight' && imgs.length > 1) setIdx(i => (i + 1) % imgs.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [imgs.length, onClose])

  const hasImg = imgs.length > 0
  const initials = (vp.display_name || 'V').slice(0, 2).toUpperCase()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,10,8,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', fontFamily: 'Manrope, sans-serif' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', borderRadius: 24, background: '#fff', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>

        {/* ── Image area ── */}
        <div style={{ position: 'relative', height: 320, flexShrink: 0, overflow: 'hidden', borderRadius: '24px 24px 0 0', background: '#1a1208' }}>
          {hasImg ? (
            <img src={imgs[idx]} alt={vp.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.88 }} />
          ) : (
            /* Beautiful no-image placeholder */
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(145deg, #2c1f16 0%, #4a3020 40%, #3d2a1e 70%, #261810 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
              {/* Decorative rings */}
              <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', border: '1px solid rgba(196,151,90,0.12)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', border: '1px solid rgba(196,151,90,0.18)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(196,151,90,0.25)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
              {/* Initials */}
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(196,151,90,0.15)', border: '2px solid rgba(196,151,90,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#C4975A', letterSpacing: '0.05em' }}>
                  {initials}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(196,151,90,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Venue</div>
              </div>
            </div>
          )}

          {/* Gradient overlay — name lives here */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />

          {/* Top controls */}
          <button onClick={onClose} style={{ position: 'absolute', top: 14, left: 14, width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <X size={16} />
          </button>
          <div style={{ position: 'absolute', top: 14, right: 14 }}>
            <StatusPill status={venue.availability_status || 'pending'} light />
          </div>

          {/* Image nav */}
          {imgs.length > 1 && (
            <>
              <button onClick={() => setIdx(i => (i - 1 + imgs.length) % imgs.length)} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setIdx(i => (i + 1) % imgs.length)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                <ChevronRight size={16} />
              </button>
              <div style={{ position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 5 }}>
                {imgs.map((_, i) => (
                  <button key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 20 : 6, height: 6, borderRadius: 3, background: i === idx ? '#C4975A' : 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }} />
                ))}
              </div>
            </>
          )}

          {/* Name + location overlaid on gradient */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 24px 22px' }}>
            {vp.venue_type && (
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#C4975A', textTransform: 'uppercase', marginBottom: 6 }}>
                {vp.venue_type}
              </div>
            )}
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 6px', lineHeight: 1.15, letterSpacing: '-0.01em' }}>
              {vp.display_name || '—'}
            </h2>
            {(vp.city || venue.location) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>
                <MapPin size={13} /> {venue.location || vp.city}
              </div>
            )}
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={{ padding: '24px 28px 28px', flex: 1 }}>

          {/* Tags row */}
          {(venue.capacity) && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              {venue.capacity && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5c4a3d', background: '#f5ede0', padding: '7px 14px', borderRadius: 30 }}>
                  <Users size={13} color="#C4975A" /> Hasta {venue.capacity} invitados
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {venue.short_desc && (
            <p style={{ fontSize: 14, color: '#5c4a3d', lineHeight: 1.7, marginBottom: 24 }}>
              {venue.short_desc}
            </p>
          )}

          {/* CTA */}
          {venue.venue_quote_url && (
            <a href={venue.venue_quote_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 0', borderRadius: 12, background: '#C4975A', color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.02em' }}>
              <FileText size={16} /> Ver presupuesto
            </a>
          )}

          {!venue.venue_quote_url && !venue.short_desc && !venue.capacity && (
            <p style={{ fontSize: 13, color: '#b8ada7', textAlign: 'center', padding: '16px 0' }}>
              Tu wedding planner te enviará más información próximamente.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ─────────────────────────────────────────── */
export default function CoupleLandingClient({ client, venues, caterings }: { client: any; venues: any[]; caterings: any[] }) {
  const [password, setPassword]         = useState('')
  const [unlocked, setUnlocked]         = useState(!client.proposal_password)
  const [wrongPass, setWrongPass]       = useState(false)
  const [favorites, setFavorites]       = useState<Set<string>>(new Set())
  const [comment, setComment]           = useState('')
  const [commentTarget, setCommentTarget] = useState<string | null>(null)
  const [sending, setSending]           = useState(false)
  const [sentComments, setSentComments] = useState<Set<string>>(new Set())
  const [openVenue, setOpenVenue]       = useState<any | null>(null)

  const countdown  = useCountdown(client.proposal_expires_at || null)
  const isExpired  = countdown?.expired ?? false
  const canInteract = !isExpired

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === client.proposal_password) { setUnlocked(true); setWrongPass(false) }
    else setWrongPass(true)
  }

  const toggleFavorite = async (entityId: string, type: 'venue' | 'catering') => {
    if (!canInteract) return
    const isFav = favorites.has(entityId)
    setFavorites(prev => { const n = new Set(prev); isFav ? n.delete(entityId) : n.add(entityId); return n })
    await createClient().from('wp_couple_feedback').insert({
      client_id: client.id,
      venue_user_id:    type === 'venue'    ? entityId : null,
      catering_user_id: type === 'catering' ? entityId : null,
      type: isFav ? 'unfavorite' : 'favorite',
    })
  }

  const sendComment = async (entityId: string, type: 'venue' | 'catering') => {
    if (!comment.trim() || !canInteract) return
    setSending(true)
    await createClient().from('wp_couple_feedback').insert({
      client_id: client.id,
      venue_user_id:    type === 'venue'    ? entityId : null,
      catering_user_id: type === 'catering' ? entityId : null,
      type: 'comment', comment_text: comment.trim(),
    })
    setSentComments(prev => new Set([...prev, entityId]))
    setComment(''); setCommentTarget(null); setSending(false)
  }

  /* ── Password gate ── */
  if (!unlocked) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf9f7', fontFamily: 'Manrope, sans-serif', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: '44px 40px', maxWidth: 380, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Lock size={26} color="#C4975A" />
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#3d3530', marginBottom: 8 }}>Propuesta protegida</h1>
        <p style={{ fontSize: 13, color: '#9c8f88', marginBottom: 28, lineHeight: 1.6 }}>Tu wedding planner ha protegido esta propuesta con contraseña.</p>
        <form onSubmit={handleUnlock}>
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${wrongPass ? '#ef4444' : '#e8e4df'}`, fontSize: 14, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: 8 }} />
          {wrongPass && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>Contraseña incorrecta</p>}
          <button type="submit" style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: '#3d3530', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Acceder
          </button>
        </form>
      </div>
    </div>
  )

  const weddingDateStr = client.wedding_date
    ? new Date(client.wedding_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  /* ── Venue card ── */
  const VenueCard = ({ v }: { v: any }) => {
    const vp = v.venue_prof || {}
    const entityId = v.venue_user_id
    const isFav = favorites.has(entityId)
    const commented = sentComments.has(entityId)
    const heroImg = v.hero_image || (v.gallery?.[0]?.url) || null

    return (
      <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s' }}
        onClick={() => setOpenVenue(v)}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.12)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 16px rgba(0,0,0,0.07)' }}
      >
        {/* Image */}
        <div style={{ height: 160, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #3d3530, #5c4a3d)' }}>
          {heroImg
            ? <img src={heroImg} alt={vp.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.9 }} />
            : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'rgba(196,151,90,0.6)', letterSpacing: '0.05em' }}>{(vp.display_name || 'V').slice(0, 2).toUpperCase()}</div>
          }
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <StatusPill status={v.availability_status || 'pending'} light />
          </div>
          {vp.venue_type && (
            <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#C4975A', textTransform: 'uppercase' }}>
              {vp.venue_type}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px 16px' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#3d3530', marginBottom: 3 }}>{vp.display_name || '—'}</h3>
          {vp.city && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9c8f88', marginBottom: 12 }}>
              <MapPin size={11} /> {vp.city}
            </div>
          )}

          {v.venue_quote_url && (
            <a href={v.venue_quote_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#C4975A', textDecoration: 'none', marginBottom: 10, padding: '5px 10px', background: 'rgba(196,151,90,0.08)', borderRadius: 8, border: '1px solid rgba(196,151,90,0.2)' }}>
              <FileText size={11} /> Ver presupuesto
            </a>
          )}

          {canInteract ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleFavorite(entityId, 'venue')}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1.5px solid ${isFav ? '#e91e63' : '#ede9e4'}`, background: isFav ? 'rgba(233,30,99,0.06)' : 'transparent', color: isFav ? '#e91e63' : '#9c8f88', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.15s' }}>
                  <Heart size={12} fill={isFav ? '#e91e63' : 'none'} /> {isFav ? 'Favorito' : 'Me gusta'}
                </button>
                <button onClick={() => setCommentTarget(commentTarget === entityId ? null : entityId)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1.5px solid #ede9e4', background: 'transparent', color: '#9c8f88', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  {commented ? <Check size={12} color="#22c55e" /> : <MessageSquare size={12} />}
                  {commented ? 'Enviado' : 'Comentar'}
                </button>
              </div>
              {commentTarget === entityId && !commented && (
                <div style={{ marginTop: 10 }}>
                  <textarea placeholder="Escribe tu opinión…" value={comment} onChange={e => setComment(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e4df', fontSize: 12, resize: 'vertical', minHeight: 64, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={() => sendComment(entityId, 'venue')} disabled={sending || !comment.trim()}
                    style={{ marginTop: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#C4975A', color: '#fff', fontSize: 12, fontWeight: 600, cursor: comment.trim() ? 'pointer' : 'default', opacity: comment.trim() ? 1 : 0.45 }}>
                    Enviar
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '8px 0', fontSize: 12, color: '#b8ada7', textAlign: 'center' }}>Plazo de respuesta finalizado</div>
          )}
        </div>
      </div>
    )
  }

  /* ── Catering card ── */
  const CateringCard = ({ c }: { c: any }) => {
    const cp = c.cat_prof || {}
    const entityId = c.catering_user_id
    const isFav = favorites.has(entityId)
    const commented = sentComments.has(entityId)

    return (
      <div style={{ background: '#fff', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
        <div style={{ height: 100, background: 'linear-gradient(135deg, #0f3d1f, #1a5c30)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>{(cp.display_name || 'C').slice(0, 2).toUpperCase()}</div>
          <div style={{ position: 'absolute', top: 10, right: 10 }}>
            <StatusPill status={c.availability_status || 'pending'} light />
          </div>
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#3d3530', marginBottom: 3 }}>{cp.display_name || '—'}</h3>
          {cp.city && <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9c8f88', marginBottom: 12 }}><MapPin size={11} /> {cp.city}</div>}
          {c.venue_quote_url && (
            <a href={c.venue_quote_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#C4975A', textDecoration: 'none', marginBottom: 10, padding: '5px 10px', background: 'rgba(196,151,90,0.08)', borderRadius: 8, border: '1px solid rgba(196,151,90,0.2)' }}>
              <FileText size={11} /> Ver presupuesto
            </a>
          )}
          {canInteract ? (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => toggleFavorite(entityId, 'catering')}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: `1.5px solid ${isFav ? '#e91e63' : '#ede9e4'}`, background: isFav ? 'rgba(233,30,99,0.06)' : 'transparent', color: isFav ? '#e91e63' : '#9c8f88', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Heart size={12} fill={isFav ? '#e91e63' : 'none'} /> {isFav ? 'Favorito' : 'Me gusta'}
                </button>
                <button onClick={() => setCommentTarget(commentTarget === entityId ? null : entityId)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 9, border: '1.5px solid #ede9e4', background: 'transparent', color: '#9c8f88', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  {commented ? <Check size={12} color="#22c55e" /> : <MessageSquare size={12} />}
                  {commented ? 'Enviado' : 'Comentar'}
                </button>
              </div>
              {commentTarget === entityId && !commented && (
                <div style={{ marginTop: 10 }}>
                  <textarea placeholder="Escribe tu opinión…" value={comment} onChange={e => setComment(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e4df', fontSize: 12, resize: 'vertical', minHeight: 64, fontFamily: 'Manrope, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={() => sendComment(entityId, 'catering')} disabled={sending || !comment.trim()}
                    style={{ marginTop: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: comment.trim() ? 'pointer' : 'default', opacity: comment.trim() ? 1 : 0.45 }}>
                    Enviar
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '8px 0', fontSize: 12, color: '#b8ada7', textAlign: 'center' }}>Plazo de respuesta finalizado</div>
          )}
        </div>
      </div>
    )
  }

  /* ── Render ── */
  return (
    <div style={{ minHeight: '100vh', background: '#faf9f7', fontFamily: 'Manrope, sans-serif' }}>
      {openVenue && <VenueModal venue={openVenue} onClose={() => setOpenVenue(null)} />}

      {/* Hero */}
      <div style={{ background: 'linear-gradient(160deg, #2c2420 0%, #4a3828 50%, #3d3530 100%)', padding: '52px 24px 44px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>💍</div>
        <h1 style={{ fontSize: 30, fontWeight: 300, letterSpacing: '0.06em', marginBottom: 10, lineHeight: 1.2 }}>
          Propuesta para <strong style={{ fontWeight: 800 }}>{client.name}</strong>
        </h1>

        {weddingDateStr && (
          <p style={{ fontSize: 14, opacity: 0.65, marginBottom: 4 }}>{weddingDateStr}</p>
        )}
        {client.guest_count && (
          <p style={{ fontSize: 13, opacity: 0.45, marginBottom: 0 }}>{client.guest_count} invitados</p>
        )}

        {/* ── Countdown to proposal deadline ── */}
        {countdown && !countdown.expired && (
          <>
            <p style={{ fontSize: 11, opacity: 0.45, marginTop: 20, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tiempo para responder</p>
            <div style={{ display: 'inline-flex', gap: 0, marginTop: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 24px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}>
              {([
                { val: countdown.d, label: 'días' },
                { val: countdown.h, label: 'horas' },
                { val: countdown.m, label: 'min' },
                { val: countdown.s, label: 'seg' },
              ]).map(({ val, label }, i, arr) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center', minWidth: 52 }}>
                    <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>
                      {String(val).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ fontSize: 22, fontWeight: 300, opacity: 0.3, margin: '0 2px', paddingBottom: 12 }}>:</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 13, opacity: 0.55, marginTop: 20, lineHeight: 1.65 }}>
          {canInteract
            ? <>Explora las opciones que hemos seleccionado para vuestra boda.<br />Haz clic en cada opción para ver más detalles y dejad vuestra respuesta.</>
            : 'El plazo para responder ha finalizado. Podéis seguir explorando las opciones.'
          }
        </p>
      </div>

      {/* ── Expired banner ── */}
      {isExpired && (
        <div style={{ background: '#fef3cd', borderBottom: '1px solid #f5dba0', padding: '12px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#7a5c00', fontWeight: 500, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
            El plazo para responder ha finalizado. Si queréis dar vuestra opinión, contactad con vuestro wedding planner.
          </p>
        </div>
      )}

      {/* Content */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '44px 24px' }}>

        {venues.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <Building2 size={20} color="#C4975A" />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3d3530' }}>Venues propuestos</h2>
              <span style={{ fontSize: 13, color: '#b8ada7' }}>({venues.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {venues.map((v: any) => <VenueCard key={v.id} v={v} />)}
            </div>
          </section>
        )}

        {caterings.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <UtensilsCrossed size={20} color="#16a34a" />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#3d3530' }}>Caterings propuestos</h2>
              <span style={{ fontSize: 13, color: '#b8ada7' }}>({caterings.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {caterings.map((c: any) => <CateringCard key={c.id} c={c} />)}
            </div>
          </section>
        )}

        {venues.length === 0 && caterings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>✨</div>
            <p style={{ fontSize: 15, color: '#9c8f88' }}>Tu wedding planner está preparando la propuesta.</p>
          </div>
        )}

        <div style={{ marginTop: 52, paddingTop: 24, borderTop: '1px solid #ede9e4', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#c8bdb7' }}>Propuesta preparada por tu wedding planner · Wedding Venues Spain</p>
        </div>
      </div>
    </div>
  )
}
