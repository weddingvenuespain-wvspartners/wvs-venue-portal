'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Search, UtensilsCrossed, MapPin, Send, X } from 'lucide-react'

export default function CateringSearchPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [caterings, setCaterings] = useState<any[]>([])
  const [filtered, setFiltered]   = useState<any[]>([])
  const [search, setSearch]       = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [venueFilter, setVenueFilter] = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  const [requestItem, setRequestItem] = useState<any>(null)
  const [clients, setClients]         = useState<any[]>([])
  const [clientVenues, setClientVenues] = useState<any[]>([])
  const [selectedClient, setSelectedClient] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [sending, setSending]         = useState(false)
  const [sendError, setSendError]     = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'wedding_planner') return
    const supabase = createClient()

    supabase
      .from('venue_profiles')
      .select('user_id, display_name, city, venue_type, venue_website')
      .eq('role', 'catering')
      .eq('status', 'active')
      .order('display_name')
      .then(({ data }) => { setCaterings(data || []); setFiltered(data || []); setDataLoading(false) })

    supabase
      .from('wp_clients')
      .select('id, name')
      .eq('planner_id', user.id)
      .order('name')
      .then(({ data }) => setClients(data || []))
  }, [user?.id, profile?.role]) // eslint-disable-line

  // When client changes, load their venues (to filter compatible caterings)
  useEffect(() => {
    if (!selectedClient || !user) return
    const supabase = createClient()
    supabase
      .from('wp_client_venues')
      .select('venue_user_id, venue_profiles!wp_client_venues_venue_user_id_fkey(display_name)')
      .eq('client_id', selectedClient)
      .then(({ data }) => setClientVenues(data || []))
  }, [selectedClient]) // eslint-disable-line

  useEffect(() => {
    let list = caterings
    if (search) list = list.filter(c => (c.display_name || '').toLowerCase().includes(search.toLowerCase()))
    if (cityFilter.trim()) list = list.filter(c => (c.city || '').toLowerCase().includes(cityFilter.toLowerCase()))
    setFiltered(list)
  }, [search, cityFilter, caterings])

  const openRequest = (item: any) => {
    setRequestItem(item)
    setSelectedClient(clients[0]?.id || '')
    setRequestNote('')
    setSendError('')
  }

  const handleSendRequest = async () => {
    if (!selectedClient) { setSendError('Selecciona una pareja'); return }
    setSending(true)
    setSendError('')
    try {
      const supabase = createClient()
      const { data: clientData } = await supabase.from('wp_clients').select('*').eq('id', selectedClient).single()

      await supabase.from('wp_client_caterings').upsert({
        client_id:        selectedClient,
        planner_id:       user!.id,
        catering_user_id: requestItem.user_id,
        availability_status: 'requested',
        planner_notes:    requestNote.trim() || null,
      }, { onConflict: 'client_id,catering_user_id' })

      // Also create a lead in the catering's system
      await supabase.from('leads').insert({
        user_id:      requestItem.user_id,
        planner_id:   user!.id,
        name:         clientData?.name,
        email:        clientData?.email || null,
        phone:        clientData?.phone || null,
        wedding_date: clientData?.wedding_date || null,
        guests:       clientData?.guest_count || null,
        budget:       clientData?.budget || 'sin_definir',
        source:       'wedding_planner',
        status:       'new',
        notes:        requestNote.trim() || null,
      })

      setRequestItem(null)
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

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Buscar catering</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Encuentra proveedores de catering y solicita disponibilidad para tus parejas.</p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder="Buscar catering..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
          <div style={{ position: 'relative', flex: '1 1 160px' }}>
            <MapPin size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray)' }} />
            <input placeholder="Ciudad..." value={cityFilter} onChange={e => setCityFilter(e.target.value)}
              style={{ ...inputSt, paddingLeft: 30 }} />
          </div>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <UtensilsCrossed size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>
              {caterings.length === 0 ? 'Aún no hay caterings registrados en la plataforma' : 'Sin resultados'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
              {caterings.length === 0 ? 'Los proveedores de catering aparecerán aquí cuando se unan.' : 'Prueba con otros filtros'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 14 }}>
              {filtered.length} catering{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {filtered.map((c: any) => {
                const initials = (c.display_name || 'C').slice(0, 2).toUpperCase()
                return (
                  <div key={c.user_id} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 80, background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 16, color: '#16a34a' }}>
                        {initials}
                      </div>
                      {c.venue_type && (
                        <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: '#16a34a', fontWeight: 600 }}>
                          {c.venue_type}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '14px 16px', flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>{c.display_name || 'Sin nombre'}</div>
                      {c.city && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--warm-gray)', marginBottom: 10 }}>
                          <MapPin size={11} /> {c.city}
                        </div>
                      )}
                      {c.venue_website && (
                        <a href={c.venue_website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#16a34a', textDecoration: 'none' }}>
                          {c.venue_website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--ivory)' }}>
                      <button
                        onClick={() => openRequest(c)}
                        disabled={clients.length === 0}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 8, border: 'none',
                          background: clients.length === 0 ? 'var(--ivory)' : '#16a34a',
                          color: clients.length === 0 ? 'var(--warm-gray)' : '#fff',
                          fontSize: 12, fontWeight: 500, cursor: clients.length === 0 ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
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

      {/* Modal */}
      {requestItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setRequestItem(null) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 17, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Solicitar disponibilidad</h2>
                <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>{requestItem.display_name}</p>
              </div>
              <button onClick={() => setRequestItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
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
              <select value={selectedClient} onChange={e => setSelectedClient(e.target.value)}
                style={{ ...inputSt, background: 'var(--cream)' }}>
                <option value="">Selecciona una pareja</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>Mensaje (opcional)</label>
              <textarea placeholder="Ej: Boda para ~180 personas, cocina mediterránea…"
                value={requestNote} onChange={e => setRequestNote(e.target.value)}
                style={{ ...inputSt, minHeight: 80, resize: 'vertical', padding: '9px 12px', background: 'var(--cream)' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setRequestItem(null)}
                style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleSendRequest} disabled={sending}
                style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 500, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Send size={13} /> {sending ? 'Enviando…' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
