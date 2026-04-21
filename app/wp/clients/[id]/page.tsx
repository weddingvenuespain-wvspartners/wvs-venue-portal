'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import {
  Heart, Building2, UtensilsCrossed, FileText, ChevronLeft, Calendar, Users,
  Trash2, CheckCircle, ExternalLink, Send, Copy, Lock, Search, MapPin, X, Plus, MessageSquare,
} from 'lucide-react'

type Tab = 'venues' | 'catering' | 'propuesta' | 'pareja'

const AVAIL_LABEL: Record<string, string> = { pending: 'Sin solicitar', requested: 'Solicitado', available: 'Disponible', unavailable: 'No disponible' }
const AVAIL_COLOR: Record<string, string> = { pending: 'var(--warm-gray)', requested: '#3b82f6', available: '#22c55e', unavailable: '#ef4444' }

const VENUE_TYPES = ['Todos', 'Finca', 'Hotel', 'Castillo / Palacio', 'Jardín / Exterior', 'Masía', 'Otro']

// ── Venue / Catering search modal ─────────────────────────────────────────────

function SearchProviderModal({
  mode,
  clientId,
  clientData,
  userId,
  alreadyAdded,
  onClose,
  onAdded,
}: {
  mode: 'venue' | 'catering'
  clientId: string
  clientData: any
  userId: string
  alreadyAdded: string[]
  onClose: () => void
  onAdded: (entry: any) => void
}) {
  const [providers, setProviders] = useState<any[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [cityFilter, setCityFilter] = useState('')
  const [showOnlyFavs, setShowOnlyFavs] = useState(false)

  const [requestTarget, setRequestTarget] = useState<any>(null)
  const [note, setNote]   = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    const url = mode === 'venue' ? '/api/venues/list' : '/api/catering/list'
    const supabase = createClient()
    Promise.all([
      fetch(url).then(r => r.json()),
      mode === 'venue'
        ? supabase.from('wp_planner_favorites').select('venue_user_id').eq('planner_id', userId)
        : Promise.resolve({ data: [] }),
    ]).then(([data, favsRes]) => {
      setProviders(Array.isArray(data) ? data : [])
      setFavorites(new Set((favsRes.data || []).map((f: any) => f.venue_user_id)))
      setLoadingProviders(false)
    }).catch(() => setLoadingProviders(false))
  }, [mode, userId])

  const filtered = useMemo(() => {
    let list = showOnlyFavs ? providers.filter(p => favorites.has(p.user_id)) : providers
    if (search) list = list.filter(p => (p.display_name || '').toLowerCase().includes(search.toLowerCase()) || (p.city || '').toLowerCase().includes(search.toLowerCase()))
    if (cityFilter.trim()) list = list.filter(p => (p.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    if (mode === 'venue' && typeFilter !== 'Todos') list = list.filter(p => p.venue_type === typeFilter)
    // Favorites always bubble to top
    return [...list].sort((a, b) => (favorites.has(b.user_id) ? 1 : 0) - (favorites.has(a.user_id) ? 1 : 0))
  }, [providers, favorites, showOnlyFavs, search, cityFilter, typeFilter, mode])

  const attachAndAdd = (type: 'venue' | 'catering', row: any) => {
    if (type === 'venue') {
      onAdded({ type: 'venue', entry: {
        ...row,
        venue_prof: { display_name: requestTarget!.display_name, city: requestTarget!.city, venue_type: requestTarget!.venue_type, venue_website: requestTarget!.venue_website },
      }})
    } else {
      onAdded({ type: 'catering', entry: {
        ...row,
        cat_prof: { display_name: requestTarget!.display_name, city: requestTarget!.city, venue_type: requestTarget!.venue_type },
      }})
    }
    setSentSet(prev => new Set([...prev, requestTarget!.user_id]))
    setRequestTarget(null)
    setNote('')
  }

  const handleAddOnly = async () => {
    if (!requestTarget) return
    setSending(true); setSendError('')
    try {
      const supabase = createClient()
      if (mode === 'venue') {
        const { data: wv, error } = await supabase.from('wp_client_venues').upsert({
          client_id: clientId, planner_id: userId, venue_user_id: requestTarget.user_id,
          availability_status: 'pending', planner_notes: note.trim() || null,
        }, { onConflict: 'client_id,venue_user_id' }).select().single()
        if (error) throw error
        attachAndAdd('venue', wv)
      } else {
        const { data: wc, error } = await supabase.from('wp_client_caterings').upsert({
          client_id: clientId, planner_id: userId, catering_user_id: requestTarget.user_id,
          availability_status: 'pending', planner_notes: note.trim() || null,
        }, { onConflict: 'client_id,catering_user_id' }).select().single()
        if (error) throw error
        attachAndAdd('catering', wc)
      }
    } catch (e: any) {
      setSendError(e.message || 'Error al añadir')
    } finally { setSending(false) }
  }

  const handleSend = async () => {
    if (!requestTarget) return
    setSending(true); setSendError('')
    try {
      if (mode === 'venue') {
        const res = await fetch('/api/wp/request-venue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ venue_user_id: requestTarget.user_id, client_id: clientId, client_data: clientData, note: note.trim() || null }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al enviar solicitud')
        attachAndAdd('venue', json.wv)
      } else {
        const supabase = createClient()
        const { data: wc, error } = await supabase.from('wp_client_caterings').upsert({
          client_id: clientId, planner_id: userId, catering_user_id: requestTarget.user_id,
          availability_status: 'requested', planner_notes: note.trim() || null,
        }, { onConflict: 'client_id,catering_user_id' }).select().single()
        if (error) throw error
        attachAndAdd('catering', wc)
      }
    } catch (e: any) {
      setSendError(e.message || 'Error al enviar')
    } finally { setSending(false) }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--ivory)',
    background: '#fff', fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }

  const label = mode === 'venue' ? 'venue' : 'catering'
  const Icon  = mode === 'venue' ? Building2 : UtensilsCrossed

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>
              Buscar {label}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--warm-gray)', margin: '2px 0 0' }}>Selecciona un {label} para solicitar disponibilidad</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tabs: Todos / Mis favoritos — venues only, always visible */}
        {mode === 'venue' && (
          <div style={{ padding: '4px', flexShrink: 0, display: 'flex', gap: 4, background: 'var(--ivory)', margin: '12px 24px 0', borderRadius: 10, width: 'fit-content' }}>
            {([
              { key: false, label: 'Todos los venues' },
              { key: true,  label: `Mis favoritos${favorites.size > 0 ? ` (${favorites.size})` : ''}` },
            ] as { key: boolean; label: string }[]).map(t => (
              <button key={String(t.key)} onClick={() => setShowOnlyFavs(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: showOnlyFavs === t.key ? 600 : 400,
                background: showOnlyFavs === t.key ? '#fff' : 'transparent',
                color: showOnlyFavs === t.key ? 'var(--charcoal)' : 'var(--warm-gray)',
                boxShadow: showOnlyFavs === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}>
                {t.key && <Heart size={11} fill={showOnlyFavs ? '#ef4444' : 'none'} color={showOnlyFavs ? '#ef4444' : 'currentColor'} />}
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ padding: '10px 24px 14px', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder={`Buscar ${label}…`} value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
          <div style={{ position: 'relative', flex: '1 1 140px' }}>
            <MapPin size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder="Ciudad…" value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ ...inputSt, paddingLeft: 28 }} />
          </div>
          {mode === 'venue' && (
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...inputSt, flex: '0 1 160px' }}>
              {VENUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>

        {/* Provider grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loadingProviders ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
              <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--warm-gray)', fontSize: 13 }}>
              <Icon size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
              <div>Sin {label}s disponibles con esos filtros</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
              {filtered.map((p: any) => {
                const alreadyLinked = alreadyAdded.includes(p.user_id)
                const justSent = sentSet.has(p.user_id)
                const isFav = favorites.has(p.user_id)
                const initials = (p.display_name || 'V').slice(0, 2).toUpperCase()
                return (
                  <div key={p.user_id} style={{ background: alreadyLinked || justSent ? '#f9fafb' : '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: isFav ? '0 1px 8px rgba(239,68,68,0.08)' : '0 1px 5px rgba(0,0,0,0.06)', border: alreadyLinked || justSent ? '1px solid var(--ivory)' : isFav ? '1px solid rgba(239,68,68,0.15)' : '1px solid transparent', opacity: alreadyLinked ? 0.7 : 1 }}>
                    <div style={{ height: 64, background: 'linear-gradient(135deg, rgba(196,151,90,0.1), rgba(196,151,90,0.03))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(196,151,90,0.15)', border: '2px solid rgba(196,151,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: 'var(--gold)', fontFamily: 'Manrope' }}>
                        {initials}
                      </div>
                      {isFav && (
                        <span style={{ position: 'absolute', top: 7, left: 7 }}>
                          <Heart size={11} fill="#ef4444" color="#ef4444" />
                        </span>
                      )}
                      {p.venue_type && (
                        <span style={{ position: 'absolute', top: 7, right: 7, fontSize: 9, padding: '2px 6px', borderRadius: 7, background: 'rgba(196,151,90,0.12)', color: 'var(--gold)', fontWeight: 700 }}>
                          {p.venue_type}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{p.display_name || 'Sin nombre'}</div>
                      {p.city && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} /> {p.city}</div>}
                      {alreadyLinked || justSent ? (
                        <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle size={11} /> {alreadyLinked ? 'Ya añadido' : 'Añadido'}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRequestTarget(p); setSendError(''); setNote('') }}
                          style={{ width: '100%', padding: '6px 0', borderRadius: 7, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          Añadir
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Request confirm modal (nested) */}
      {requestTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setRequestTarget(null) }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700, color: 'var(--charcoal)', margin: 0 }}>Añadir a la propuesta</h3>
                <p style={{ fontSize: 12, color: 'var(--warm-gray)', margin: '3px 0 0' }}>{requestTarget.display_name}</p>
              </div>
              <button onClick={() => setRequestTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={15} /></button>
            </div>
            {sendError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px', color: '#dc2626', fontSize: 12, marginBottom: 14 }}>
                {sendError}
              </div>
            )}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 5 }}>Nota interna (opcional)</label>
              <textarea placeholder="Ej: Boda para ~150 personas, primavera 2026…" value={note} onChange={e => setNote(e.target.value)}
                style={{ ...inputSt, minHeight: 64, resize: 'vertical', padding: '8px 12px' }} />
            </div>
            {/* Two clearly separated actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <button onClick={handleAddOnly} disabled={sending}
                style={{ padding: '10px 0', borderRadius: 9, border: '1.5px solid var(--ivory)', background: '#fff', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                Solo añadir
                <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--warm-gray)', marginTop: 2 }}>Sin solicitar fechas</div>
              </button>
              <button onClick={handleSend} disabled={sending}
                style={{ padding: '10px 0', borderRadius: 9, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.6 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Send size={11} /> {sending ? 'Enviando…' : 'Solicitar disponibilidad'}</span>
                <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>Envía notificación al venue</span>
              </button>
            </div>
            <button onClick={() => setRequestTarget(null)}
              style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--warm-gray)', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, profile, loading } = useAuth()

  const [client, setClient]       = useState<any>(null)
  const [venues, setVenues]       = useState<any[]>([])
  const [caterings, setCaterings] = useState<any[]>([])
  const [feedback, setFeedback]   = useState<any[]>([])
  const [tab, setTab]             = useState<Tab>('venues')
  const [dataLoading, setDataLoading] = useState(true)

  const [showVenueModal, setShowVenueModal]     = useState(false)
  const [showCateringModal, setShowCateringModal] = useState(false)

  // Inline editing for venue/catering rows
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null)
  const [editStatus, setEditStatus]       = useState<Record<string, string>>({})
  const [editQuoteUrl, setEditQuoteUrl]   = useState<Record<string, string>>({})
  const [savingEntry, setSavingEntry]     = useState<string | null>(null)

  // Propuesta state
  const [propPassword, setPropPassword] = useState('')
  const [propExpiry, setPropExpiry]     = useState('')
  const [savingProp, setSavingProp]     = useState(false)
  const [propSaved, setPropSaved]       = useState(false)
  const [copiedLink, setCopiedLink]     = useState(false)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  const load = async () => {
    if (!user || id === 'new') return
    const supabase = createClient()

    const [clientRes, venuesRes, cateringsRes, feedbackRes] = await Promise.all([
      supabase.from('wp_clients').select('*').eq('id', id).eq('planner_id', user.id).single(),
      supabase.from('wp_client_venues').select('*').eq('client_id', id),
      supabase.from('wp_client_caterings').select('*').eq('client_id', id),
      supabase.from('wp_couple_feedback').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ])

    if (clientRes.data) {
      setClient(clientRes.data)
      setPropPassword(clientRes.data.proposal_password || '')
      if (clientRes.data.proposal_expires_at) {
        // Convert to local datetime-local format (YYYY-MM-DDTHH:mm)
        const d = new Date(clientRes.data.proposal_expires_at)
        setPropExpiry(d.toISOString().slice(0, 16))
      }
    }

    // Fetch venue_profiles separately (venue_user_id FK points to auth.users, not venue_profiles)
    const venueRows = venuesRes.data || []
    const cateringRows = cateringsRes.data || []

    if (venueRows.length > 0) {
      const venueIds = venueRows.map((v: any) => v.venue_user_id)
      const { data: vProfs } = await supabase.from('venue_profiles').select('user_id, display_name, city, venue_type, venue_website').in('user_id', venueIds)
      const profMap = Object.fromEntries((vProfs || []).map((p: any) => [p.user_id, p]))
      setVenues(venueRows.map((v: any) => ({ ...v, venue_prof: profMap[v.venue_user_id] || null })))
    } else {
      setVenues([])
    }

    if (cateringRows.length > 0) {
      const catIds = cateringRows.map((c: any) => c.catering_user_id)
      const { data: cProfs } = await supabase.from('venue_profiles').select('user_id, display_name, city, venue_type').in('user_id', catIds)
      const profMap = Object.fromEntries((cProfs || []).map((p: any) => [p.user_id, p]))
      setCaterings(cateringRows.map((c: any) => ({ ...c, cat_prof: profMap[c.catering_user_id] || null })))
    } else {
      setCaterings([])
    }

    setFeedback(feedbackRes.data || [])
    setDataLoading(false)
  }

  useEffect(() => { if (user && profile?.role === 'wedding_planner') load() }, [user?.id, id, profile?.role]) // eslint-disable-line

  const handleSaveProposal = async () => {
    setSavingProp(true)
    try {
      const supabase = createClient()
      const expiresAt = propExpiry ? new Date(propExpiry).toISOString() : null
      await supabase.from('wp_clients').update({ proposal_password: propPassword.trim() || null, proposal_expires_at: expiresAt, proposal_status: 'sent', updated_at: new Date().toISOString() }).eq('id', id)
      setClient((c: any) => ({ ...c, proposal_status: 'sent', proposal_password: propPassword.trim() || null, proposal_expires_at: expiresAt }))
      setPropSaved(true); setTimeout(() => setPropSaved(false), 2000)
    } finally { setSavingProp(false) }
  }

  const handleRemoveVenue = async (wvId: string) => {
    await createClient().from('wp_client_venues').delete().eq('id', wvId)
    setVenues(prev => prev.filter((v: any) => v.id !== wvId))
  }

  const handleRemoveCatering = async (wcId: string) => {
    await createClient().from('wp_client_caterings').delete().eq('id', wcId)
    setCaterings(prev => prev.filter((c: any) => c.id !== wcId))
  }

  const openEntry = (id: string, status: string, quoteUrl: string) => {
    setExpandedEntry(prev => prev === id ? null : id)
    setEditStatus(prev => ({ ...prev, [id]: status || 'pending' }))
    setEditQuoteUrl(prev => ({ ...prev, [id]: quoteUrl || '' }))
  }

  const saveEntry = async (entryId: string, table: 'wp_client_venues' | 'wp_client_caterings') => {
    setSavingEntry(entryId)
    const supabase = createClient()
    await supabase.from(table).update({
      availability_status: editStatus[entryId],
      venue_quote_url:     editQuoteUrl[entryId] || null,
    }).eq('id', entryId)
    if (table === 'wp_client_venues') {
      setVenues(prev => prev.map((v: any) => v.id === entryId
        ? { ...v, availability_status: editStatus[entryId], venue_quote_url: editQuoteUrl[entryId] || null }
        : v))
    } else {
      setCaterings(prev => prev.map((c: any) => c.id === entryId
        ? { ...c, availability_status: editStatus[entryId], venue_quote_url: editQuoteUrl[entryId] || null }
        : c))
    }
    setSavingEntry(null)
    setExpandedEntry(null)
  }

  const handleProviderAdded = ({ type, entry }: { type: 'venue' | 'catering'; entry: any }) => {
    if (type === 'venue') setVenues(prev => {
      const exists = prev.find((v: any) => v.id === entry.id)
      return exists ? prev.map((v: any) => v.id === entry.id ? entry : v) : [entry, ...prev]
    })
    else setCaterings(prev => {
      const exists = prev.find((c: any) => c.id === entry.id)
      return exists ? prev.map((c: any) => c.id === entry.id ? entry : c) : [entry, ...prev]
    })
  }

  const publicUrl = client ? `${typeof window !== 'undefined' ? window.location.origin : ''}/para/${client.slug}` : ''
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000) }

  if (id === 'new') { router.replace('/wp/clients'); return null }

  if (dataLoading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </div>
  )

  if (!client) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--warm-gray)' }}>Pareja no encontrada.</p>
      </div>
    </div>
  )

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ivory)',
    background: 'var(--cream)', fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }

  const tabBtn = (t: Tab, lbl: string, icon: React.ReactNode, count?: number) => (
    <button onClick={() => setTab(t)} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
      border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
      background: tab === t ? 'var(--charcoal)' : 'transparent',
      color: tab === t ? '#fff' : 'var(--warm-gray)',
      fontSize: 13, fontWeight: tab === t ? 600 : 400,
    }}>
      {icon} {lbl}
      {count != null && count > 0 && (
        <span style={{ background: tab === t ? 'rgba(255,255,255,0.2)' : 'var(--ivory)', borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>
          {count}
        </span>
      )}
    </button>
  )

  const addedVenueIds   = venues.map((v: any) => v.venue_user_id)
  const addedCateringIds = caterings.map((c: any) => c.catering_user_id)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        {/* Breadcrumb */}
        <Link href="/wp/clients" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft size={13} /> Mis parejas
        </Link>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={22} color="var(--gold)" />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{client.name}</h1>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {client.wedding_date && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                    <Calendar size={11} />
                    {new Date(client.wedding_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                )}
                {client.guest_count && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)' }}>
                    <Users size={11} /> {client.guest_count} invitados
                  </span>
                )}
                {client.email && <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{client.email}</span>}
                {client.language && <span style={{ fontSize: 12, color: 'var(--warm-gray)' }}>· {client.language.split(',').join(', ')}</span>}
              </div>
            </div>
          </div>
          {client.notes && (
            <div style={{ maxWidth: 280, background: '#fff', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--warm-gray)', borderLeft: '3px solid var(--gold)' }}>
              {client.notes}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--ivory)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
          {tabBtn('venues',   'Venues',        <Building2 size={13} />,      venues.length)}
          {tabBtn('catering', 'Catering',      <UtensilsCrossed size={13} />, caterings.length)}
          {tabBtn('propuesta', 'Propuesta web', <FileText size={13} />)}
          {tabBtn('pareja',   'Respuesta pareja', <Heart size={13} />,        feedback.length)}
        </div>

        {/* ── Venues tab ── */}
        {tab === 'venues' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => setShowVenueModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                <Plus size={12} /> Buscar venue
              </button>
            </div>

            {venues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 12 }}>
                <Building2 size={36} style={{ color: 'var(--ivory)', marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: 'var(--warm-gray)', marginBottom: 16 }}>Aún no has añadido ningún venue para esta pareja</div>
                <button onClick={() => setShowVenueModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  <Search size={12} /> Buscar venues →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {venues.map((v: any) => {
                  const vp = v.venue_prof || {}
                  const isOpen = expandedEntry === v.id
                  const status = v.availability_status || 'pending'
                  return (
                    <div key={v.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(196,151,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={17} color="var(--gold)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{vp.display_name || 'Venue'}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{vp.city}{vp.venue_type ? ` · ${vp.venue_type}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: AVAIL_COLOR[status], padding: '3px 8px', borderRadius: 8, background: `${AVAIL_COLOR[status]}18` }}>
                            {AVAIL_LABEL[status]}
                          </span>
                          {v.venue_quote_url && (
                            <a href={v.venue_quote_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', display: 'flex' }} title="Ver presupuesto">
                              <FileText size={13} />
                            </a>
                          )}
                          {vp.venue_website && (
                            <a href={vp.venue_website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--warm-gray)', display: 'flex' }}>
                              <ExternalLink size={13} />
                            </a>
                          )}
                          <button onClick={() => openEntry(v.id, status, v.venue_quote_url || '')}
                            style={{ background: isOpen ? 'var(--ivory)' : 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', color: 'var(--charcoal)', padding: '3px 8px', fontSize: 11, fontWeight: 500 }}>
                            {isOpen ? 'Cerrar' : 'Editar'}
                          </button>
                          <button onClick={() => handleRemoveVenue(v.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '14px 18px 16px', borderTop: '1px solid var(--ivory)', background: '#faf9f7', display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Estado</label>
                            <select value={editStatus[v.id] || status} onChange={e => setEditStatus(prev => ({ ...prev, [v.id]: e.target.value }))}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--ivory)', background: '#fff', fontSize: 12, fontFamily: 'Manrope, sans-serif', color: 'var(--charcoal)', outline: 'none' }}>
                              <option value="pending">Sin solicitar</option>
                              <option value="requested">Solicitado</option>
                              <option value="available">Disponible</option>
                              <option value="unavailable">No disponible</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Enlace presupuesto / propuesta</label>
                            <input type="url" placeholder="https://…" value={editQuoteUrl[v.id] ?? ''} onChange={e => setEditQuoteUrl(prev => ({ ...prev, [v.id]: e.target.value }))}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--ivory)', background: '#fff', fontSize: 12, fontFamily: 'Manrope, sans-serif', color: 'var(--charcoal)', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <button onClick={() => saveEntry(v.id, 'wp_client_venues')} disabled={savingEntry === v.id}
                            style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {savingEntry === v.id ? '…' : 'Guardar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Catering tab ── */}
        {tab === 'catering' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => setShowCateringModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                <Plus size={12} /> Buscar catering
              </button>
            </div>

            {caterings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', background: '#fff', borderRadius: 12 }}>
                <UtensilsCrossed size={36} style={{ color: 'var(--ivory)', marginBottom: 12 }} />
                <div style={{ fontSize: 14, color: 'var(--warm-gray)', marginBottom: 16 }}>Aún no has añadido ningún catering para esta pareja</div>
                <button onClick={() => setShowCateringModal(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                  <Search size={12} /> Buscar catering →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {caterings.map((c: any) => {
                  const cp = c.cat_prof || {}
                  const isOpen = expandedEntry === c.id
                  const status = c.availability_status || 'pending'
                  return (
                    <div key={c.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <UtensilsCrossed size={17} color="#16a34a" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{cp.display_name || 'Catering'}</div>
                          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{cp.city}{cp.venue_type ? ` · ${cp.venue_type}` : ''}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: AVAIL_COLOR[status], padding: '3px 8px', borderRadius: 8, background: `${AVAIL_COLOR[status]}18` }}>
                            {AVAIL_LABEL[status]}
                          </span>
                          {c.venue_quote_url && (
                            <a href={c.venue_quote_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', display: 'flex' }} title="Ver presupuesto">
                              <FileText size={13} />
                            </a>
                          )}
                          <button onClick={() => openEntry(c.id, status, c.venue_quote_url || '')}
                            style={{ background: isOpen ? 'var(--ivory)' : 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', color: 'var(--charcoal)', padding: '3px 8px', fontSize: 11, fontWeight: 500 }}>
                            {isOpen ? 'Cerrar' : 'Editar'}
                          </button>
                          <button onClick={() => handleRemoveCatering(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '14px 18px 16px', borderTop: '1px solid var(--ivory)', background: '#faf9f7', display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 10, alignItems: 'end' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Estado</label>
                            <select value={editStatus[c.id] || status} onChange={e => setEditStatus(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--ivory)', background: '#fff', fontSize: 12, fontFamily: 'Manrope, sans-serif', color: 'var(--charcoal)', outline: 'none' }}>
                              <option value="pending">Sin solicitar</option>
                              <option value="requested">Solicitado</option>
                              <option value="available">Disponible</option>
                              <option value="unavailable">No disponible</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Enlace presupuesto / propuesta</label>
                            <input type="url" placeholder="https://…" value={editQuoteUrl[c.id] ?? ''} onChange={e => setEditQuoteUrl(prev => ({ ...prev, [c.id]: e.target.value }))}
                              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid var(--ivory)', background: '#fff', fontSize: 12, fontFamily: 'Manrope, sans-serif', color: 'var(--charcoal)', outline: 'none', boxSizing: 'border-box' }} />
                          </div>
                          <button onClick={() => saveEntry(c.id, 'wp_client_caterings')} disabled={savingEntry === c.id}
                            style={{ padding: '7px 14px', borderRadius: 7, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {savingEntry === c.id ? '…' : 'Guardar'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Propuesta web tab ── */}
        {tab === 'propuesta' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Configuración</h3>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                  <Lock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />Contraseña (opcional)
                </label>
                <input type="text" placeholder="Sin contraseña" value={propPassword} onChange={e => setPropPassword(e.target.value)} style={inputSt} />
                <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 5 }}>Si añades contraseña la pareja deberá introducirla para ver la propuesta.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                  Tiempo para responder
                </label>
                <input
                  type="datetime-local"
                  value={propExpiry}
                  onChange={e => setPropExpiry(e.target.value)}
                  style={inputSt}
                />
                <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 5 }}>
                  La propuesta mostrará una cuenta atrás hasta esta fecha. Al caducar, la pareja solo podrá verla sin interactuar.
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>Enlace de la propuesta</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input readOnly value={publicUrl} style={{ ...inputSt, fontSize: 11, color: 'var(--warm-gray)', flex: 1 }} />
                  <button onClick={copyLink}
                    style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--charcoal)', whiteSpace: 'nowrap' }}>
                    {copiedLink ? <CheckCircle size={13} color="#22c55e" /> : <Copy size={13} />}
                    {copiedLink ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleSaveProposal} disabled={savingProp}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: savingProp ? 'default' : 'pointer', opacity: savingProp ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {propSaved ? <><CheckCircle size={13} /> Guardado</> : <><Send size={13} /> Guardar y marcar enviada</>}
                </button>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none' }}>
                  <ExternalLink size={13} /> Vista previa
                </a>
              </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Contenido de la propuesta</h3>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em', marginBottom: 10 }}>VENUES ({venues.length})</div>
                {venues.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--warm-gray)' }}>Sin venues asignados. Añade venues desde la pestaña Venues.</p>
                  : venues.map((v: any) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--ivory)' }}>
                      <Building2 size={13} color="var(--gold)" />
                      <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{v.venue_prof?.display_name || 'Venue'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: AVAIL_COLOR[v.availability_status] }}>{AVAIL_LABEL[v.availability_status]}</span>
                    </div>
                  ))
                }
              </div>
              {caterings.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em', marginBottom: 10 }}>CATERING ({caterings.length})</div>
                  {caterings.map((c: any) => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--ivory)' }}>
                      <UtensilsCrossed size={13} color="#16a34a" />
                      <span style={{ fontSize: 12, color: 'var(--charcoal)' }}>{c.cat_prof?.display_name || 'Catering'}</span>
                    </div>
                  ))}
                </div>
              )}
              {feedback.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '0.06em', marginBottom: 10 }}>FEEDBACK DE LA PAREJA</div>
                  {feedback.slice(0, 5).map((f: any) => (
                    <div key={f.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--ivory)', fontSize: 12, color: 'var(--charcoal)' }}>
                      {f.type === 'comment' ? `💬 ${f.comment_text}` : f.type === 'favorite' ? '❤️ Marcado favorito' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Respuesta de la pareja tab ── */}
        {tab === 'pareja' && (() => {
          // Build a map: entityId → { name, type, likes, unlikes, comments[] }
          const entityMap: Record<string, { name: string; entityType: 'venue'|'catering'; likes: number; unlikes: number; comments: string[] }> = {}

          const venueNameMap = Object.fromEntries(venues.map((v: any) => [v.venue_user_id, v.venue_prof?.display_name || 'Venue']))
          const catNameMap   = Object.fromEntries(caterings.map((c: any) => [c.catering_user_id, c.cat_prof?.display_name || 'Catering']))

          feedback.forEach((f: any) => {
            const entityId   = f.venue_user_id || f.catering_user_id
            const entityType = f.venue_user_id ? 'venue' : 'catering'
            const name       = f.venue_user_id ? (venueNameMap[f.venue_user_id] || 'Venue') : (catNameMap[f.catering_user_id] || 'Catering')
            if (!entityMap[entityId]) entityMap[entityId] = { name, entityType, likes: 0, unlikes: 0, comments: [] }
            if (f.type === 'favorite')   entityMap[entityId].likes++
            if (f.type === 'unfavorite') entityMap[entityId].unlikes++
            if (f.type === 'comment' && f.comment_text) entityMap[entityId].comments.push(f.comment_text)
          })

          const entries = Object.entries(entityMap)

          if (entries.length === 0) return (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: 12 }}>
              <Heart size={36} style={{ color: 'var(--ivory)', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Aún no hay respuestas de la pareja.</div>
              <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 6 }}>Las reacciones y comentarios aparecerán aquí cuando la pareja interactúe con la propuesta.</div>
            </div>
          )

          return (
            <div style={{ display: 'grid', gap: 10 }}>
              {entries.map(([entityId, data]) => (
                <div key={entityId} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: data.comments.length ? 12 : 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: data.entityType === 'venue' ? 'rgba(196,151,90,0.1)' : 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {data.entityType === 'venue' ? <Building2 size={16} color="var(--gold)" /> : <UtensilsCrossed size={16} color="#16a34a" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{data.name}</div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        {(data.likes > 0 || data.unlikes > 0) && (
                          <span style={{ fontSize: 12, color: data.likes > data.unlikes ? '#e91e63' : 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Heart size={12} fill={data.likes > data.unlikes ? '#e91e63' : 'none'} color={data.likes > data.unlikes ? '#e91e63' : 'currentColor'} />
                            {data.likes > data.unlikes ? 'Les gusta' : 'No marcado favorito'}
                          </span>
                        )}
                        {data.comments.length > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--warm-gray)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MessageSquare size={12} /> {data.comments.length} comentario{data.comments.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {data.comments.map((txt, i) => (
                    <div key={i} style={{ background: '#faf9f7', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--charcoal)', lineHeight: 1.55, borderLeft: '3px solid var(--gold)', marginTop: 8 }}>
                      "{txt}"
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })()}

      </main>
      </div>

      {/* Venue search modal */}
      {showVenueModal && (
        <SearchProviderModal
          mode="venue"
          clientId={id}
          clientData={client}
          userId={user!.id}
          alreadyAdded={addedVenueIds}
          onClose={() => setShowVenueModal(false)}
          onAdded={e => { handleProviderAdded(e); }}
        />
      )}

      {/* Catering search modal */}
      {showCateringModal && (
        <SearchProviderModal
          mode="catering"
          clientId={id}
          clientData={client}
          userId={user!.id}
          alreadyAdded={addedCateringIds}
          onClose={() => setShowCateringModal(false)}
          onAdded={e => { handleProviderAdded(e); }}
        />
      )}
    </div>
  )
}
