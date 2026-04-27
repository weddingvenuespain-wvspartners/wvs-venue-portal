'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Search, Building2, MapPin, Send, X, Heart } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

const VENUE_TYPES = ['Todos', 'Finca', 'Hotel', 'Castillo / Palacio', 'Jardín / Exterior', 'Masía', 'Otro']

type ViewTab = 'all' | 'favorites'

export default function VenueSearchPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [venues, setVenues]           = useState<any[]>([])
  const [favorites, setFavorites]     = useState<Set<string>>(new Set())
  const [togglingFav, setTogglingFav] = useState<Set<string>>(new Set())
  const [viewTab, setViewTab]         = useState<ViewTab>('all')
  const [search, setSearch]           = useState('')
  const [typeFilter, setTypeFilter]   = useState('Todos')
  const [cityFilter, setCityFilter]   = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  // Request modal
  const [requestVenue, setRequestVenue]     = useState<any>(null)
  const [clients, setClients]               = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [requestNote, setRequestNote]       = useState('')
  const [sending, setSending]               = useState(false)
  const [sendError, setSendError]           = useState('')
  const [sent, setSent]                     = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'wedding_planner') return
    const supabase = createClient()

    Promise.all([
      fetch('/api/venues/list').then(r => r.json()),
      supabase.from('wp_planner_favorites').select('venue_user_id').eq('planner_id', user.id),
      supabase.from('wp_clients').select('id, name').eq('planner_id', user.id).order('name'),
    ]).then(([venueData, favsRes, clientsRes]) => {
      setVenues(Array.isArray(venueData) ? venueData : [])
      setFavorites(new Set((favsRes.data || []).map((f: any) => f.venue_user_id)))
      setClients(clientsRes.data || [])
      setDataLoading(false)
    }).catch(() => setDataLoading(false))
  }, [user?.id, profile?.role]) // eslint-disable-line

  const filtered = useMemo(() => {
    let list = viewTab === 'favorites' ? venues.filter(v => favorites.has(v.user_id)) : venues
    if (search) list = list.filter(v => (v.display_name || '').toLowerCase().includes(search.toLowerCase()) || (v.city || '').toLowerCase().includes(search.toLowerCase()))
    if (typeFilter !== 'Todos') list = list.filter(v => v.venue_type === typeFilter)
    if (cityFilter.trim()) list = list.filter(v => (v.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    return list
  }, [venues, favorites, viewTab, search, typeFilter, cityFilter])

  const toggleFavorite = async (venueUserId: string) => {
    if (togglingFav.has(venueUserId)) return
    setTogglingFav(prev => new Set([...prev, venueUserId]))
    const isFav = favorites.has(venueUserId)
    // Optimistic update
    setFavorites(prev => {
      const next = new Set(prev)
      isFav ? next.delete(venueUserId) : next.add(venueUserId)
      return next
    })
    try {
      const supabase = createClient()
      if (isFav) {
        await supabase.from('wp_planner_favorites').delete().eq('planner_id', user!.id).eq('venue_user_id', venueUserId)
      } else {
        await supabase.from('wp_planner_favorites').upsert({ planner_id: user!.id, venue_user_id: venueUserId }, { onConflict: 'planner_id,venue_user_id' })
      }
    } catch {
      // Revert on error
      setFavorites(prev => {
        const next = new Set(prev)
        isFav ? next.add(venueUserId) : next.delete(venueUserId)
        return next
      })
    } finally {
      setTogglingFav(prev => { const next = new Set(prev); next.delete(venueUserId); return next })
    }
  }

  const openRequest = (venue: any) => {
    setRequestVenue(venue)
    setSelectedClient(clients[0]?.id || '')
    setRequestNote('')
    setSendError('')
  }

  const handleSendRequest = async () => {
    if (!selectedClient) { setSendError('Selecciona una pareja'); return }
    setSending(true); setSendError('')
    try {
      const supabase = createClient()
      const { data: clientData } = await supabase.from('wp_clients').select('*').eq('id', selectedClient).single()

      // Use service-role API to bypass RLS on leads table
      const res = await fetch('/api/wp/request-venue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venue_user_id: requestVenue.user_id,
          client_id:     selectedClient,
          client_data:   clientData,
          note:          requestNote.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al enviar solicitud')

      setSent(prev => new Set([...prev, `${selectedClient}-${requestVenue.user_id}`]))
      setRequestVenue(null)
    } catch (e: any) {
      setSendError(e.message || 'Error al enviar solicitud')
    } finally {
      setSending(false)
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--ivory)', background: '#fff',
    fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }

  const favCount = venues.filter(v => favorites.has(v.user_id)).length

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Venues</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
            Explora los venues disponibles, guarda tus favoritos y solicita disponibilidad para tus parejas.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--ivory)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
          {([
            { key: 'all',       label: 'Todos los venues' },
            { key: 'favorites', label: `Mis favoritos${favCount > 0 ? ` (${favCount})` : ''}` },
          ] as { key: ViewTab; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setViewTab(t.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
              borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
              background: viewTab === t.key ? '#fff' : 'transparent',
              color: viewTab === t.key ? 'var(--charcoal)' : 'var(--warm-gray)',
              fontSize: 13, fontWeight: viewTab === t.key ? 600 : 400,
              boxShadow: viewTab === t.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}>
              {t.key === 'favorites' && <Heart size={13} fill={viewTab === 'favorites' ? '#ef4444' : 'none'} color={viewTab === 'favorites' ? '#ef4444' : 'currentColor'} />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder="Buscar venue..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
          <div style={{ position: 'relative', flex: '1 1 160px' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder="Ciudad..." value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
          <div style={{ flex: '0 1 180px' }}>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VENUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <Heart size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              {viewTab === 'favorites' ? 'Aún no tienes favoritos' : 'Sin resultados'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
              {viewTab === 'favorites'
                ? 'Pulsa el corazón en cualquier venue para guardarlo aquí'
                : 'Prueba con otros filtros'}
            </div>
            {viewTab === 'favorites' && (
              <button onClick={() => setViewTab('all')} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--charcoal)' }}>
                Ver todos los venues
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              {filtered.length} venue{filtered.length !== 1 ? 's' : ''} {viewTab === 'favorites' ? 'favorito' : 'encontrado'}{filtered.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map((v: any) => {
                const isFav = favorites.has(v.user_id)
                const isToggling = togglingFav.has(v.user_id)
                const initials = (v.display_name || 'V').slice(0, 2).toUpperCase()
                return (
                  <div key={v.user_id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: isFav ? '0 2px 12px rgba(239,68,68,0.08)' : '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', border: isFav ? '1px solid rgba(239,68,68,0.15)' : '1px solid transparent', transition: 'box-shadow 0.2s, border-color 0.2s' }}>
                    {/* Card header */}
                    <div style={{ height: 80, background: 'linear-gradient(135deg, rgba(196,151,90,0.12), rgba(196,151,90,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(196,151,90,0.15)', border: '2px solid rgba(196,151,90,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--gold)' }}>
                        {initials}
                      </div>
                      {v.venue_type && (
                        <span style={{ position: 'absolute', top: 10, right: 38, fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(196,151,90,0.12)', color: 'var(--gold)', fontWeight: 600 }}>
                          {v.venue_type}
                        </span>
                      )}
                      {/* Favorite button */}
                      <button
                        onClick={() => toggleFavorite(v.user_id)}
                        disabled={isToggling}
                        title={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          background: isFav ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.8)',
                          border: isFav ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(0,0,0,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: isToggling ? 'default' : 'pointer',
                          opacity: isToggling ? 0.6 : 1,
                          transition: 'all 0.18s',
                          padding: 0,
                        }}
                      >
                        <Heart
                          size={13}
                          fill={isFav ? '#ef4444' : 'none'}
                          color={isFav ? '#ef4444' : '#9ca3af'}
                          style={{ transition: 'all 0.18s' }}
                        />
                      </button>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '14px 16px', flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{v.display_name || 'Sin nombre'}</div>
                      {v.city && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
                          <MapPin size={11} /> {v.city}
                        </div>
                      )}
                      {v.venue_website && (
                        <a href={v.venue_website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>
                          {v.venue_website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ivory)' }}>
                      <button
                        onClick={() => openRequest(v)}
                        disabled={clients.length === 0}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                          background: clients.length === 0 ? 'var(--ivory)' : 'var(--charcoal)',
                          color: clients.length === 0 ? 'var(--warm-gray)' : '#fff',
                          fontSize: 12, fontWeight: 500, cursor: clients.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <Send size={12} />
                        {clients.length === 0 ? 'Crea una pareja primero' : 'Solicitar disponibilidad'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
      </div>

      {/* Modal solicitud */}
      {requestVenue && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setRequestVenue(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Solicitar disponibilidad</h2>
                <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{requestVenue.display_name}</p>
              </div>
              <button onClick={() => setRequestVenue(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {sendError && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {sendError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>Para qué pareja *</label>
              <Select value={selectedClient || '__none__'} onValueChange={(v) => setSelectedClient(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona una pareja" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecciona una pareja</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>Mensaje al venue (opcional)</label>
              <textarea placeholder="Ej: Boda para ~200 personas, fecha flexible en primavera 2026…" value={requestNote} onChange={e => setRequestNote(e.target.value)}
                style={{ ...inputSt, minHeight: 80, resize: 'vertical', padding: '9px 12px', background: 'var(--cream)' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRequestVenue(null)}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSendRequest} disabled={sending}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={13} /> {sending ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
