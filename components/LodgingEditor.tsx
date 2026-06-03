'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, BedDouble, Coffee, CalendarDays, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react'

type RoomPrice = {
  id: string
  room_type_id: string
  date_from: string
  date_to: string
  price_per_night: number
  min_nights: number | null
  notes: string | null
}

type RoomType = {
  id: string
  name: string
  description: string | null
  total_quantity: number
  capacity_persons: number
  bed_config: string | null
  features: Array<{ icon?: string; label: string }>
  photo_urls: string[]
  sort_order: number
  is_active: boolean
  prices?: RoomPrice[]
}

type RoomExtra = {
  id: string
  name: string
  description: string | null
  pricing_unit: 'per_person_per_night' | 'per_night' | 'per_person' | 'flat'
  price: number
  applies_to_room_types: string[] | null
  is_default_included: boolean
  sort_order: number
  is_active: boolean
}

type RoomBlock = {
  id: string
  room_type_id: string
  date_from: string
  date_to: string
  quantity_blocked: number
  reason: string
  proposal_id: string | null
  notes: string | null
}

const PRICING_UNIT_LABELS: Record<string, string> = {
  per_person_per_night: 'por persona/noche',
  per_night:            'por noche',
  per_person:           'por persona',
  flat:                 'precio fijo',
}

export default function LodgingEditor({ configId, venueId }: { configId: string; venueId: string }) {
  const [tab, setTab] = useState<'rooms' | 'extras' | 'calendar'>('rooms')
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [extras, setExtras] = useState<RoomExtra[]>([])
  const [blocks, setBlocks] = useState<RoomBlock[]>([])
  const [loading, setLoading] = useState(true)

  // Room type modal state
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null)
  const [showRoomModal, setShowRoomModal] = useState(false)

  // Extra modal state
  const [editingExtra, setEditingExtra] = useState<RoomExtra | null>(null)
  const [showExtraModal, setShowExtraModal] = useState(false)

  // Price modal state
  const [pricingRoomId, setPricingRoomId] = useState<string | null>(null)
  const [editingPrice, setEditingPrice] = useState<RoomPrice | null>(null)
  const [showPriceModal, setShowPriceModal] = useState(false)

  // Block modal state
  const [showBlockModal, setShowBlockModal] = useState(false)
  const [editingBlock, setEditingBlock] = useState<RoomBlock | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const load = async () => {
    setLoading(true)
    const [r1, r2, r3] = await Promise.all([
      fetch(`/api/estructura/room-types?commercial_config_id=${configId}`).then(r => r.json()).catch(() => ({ room_types: [] })),
      fetch(`/api/estructura/room-extras?commercial_config_id=${configId}`).then(r => r.json()).catch(() => ({ extras: [] })),
      fetch(`/api/estructura/room-blocks?commercial_config_id=${configId}`).then(r => r.json()).catch(() => ({ blocks: [] })),
    ])
    setRoomTypes(r1.room_types ?? [])
    setExtras(r2.extras ?? [])
    setBlocks(r3.blocks ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [configId])

  // ── Room CRUD ───────────────────────────────────────────────────────────
  const openNewRoom = () => { setEditingRoom(null); setShowRoomModal(true) }
  const openEditRoom = (r: RoomType) => { setEditingRoom(r); setShowRoomModal(true) }
  const saveRoom = async (data: Partial<RoomType>) => {
    if (editingRoom) {
      const res = await fetch(`/api/estructura/room-types/${editingRoom.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) { setShowRoomModal(false); load() }
    } else {
      const res = await fetch('/api/estructura/room-types', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, venue_id: venueId, commercial_config_id: configId, sort_order: roomTypes.length }),
      })
      if (res.ok) { setShowRoomModal(false); load() }
    }
  }
  const deleteRoom = async (id: string) => {
    if (!confirm('¿Eliminar tipo de habitación y todas sus tarifas?')) return
    await fetch(`/api/estructura/room-types/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Extra CRUD ──────────────────────────────────────────────────────────
  const openNewExtra = () => { setEditingExtra(null); setShowExtraModal(true) }
  const openEditExtra = (e: RoomExtra) => { setEditingExtra(e); setShowExtraModal(true) }
  const saveExtra = async (data: Partial<RoomExtra>) => {
    if (editingExtra) {
      const res = await fetch(`/api/estructura/room-extras/${editingExtra.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) { setShowExtraModal(false); load() }
    } else {
      const res = await fetch('/api/estructura/room-extras', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, venue_id: venueId, commercial_config_id: configId, sort_order: extras.length }),
      })
      if (res.ok) { setShowExtraModal(false); load() }
    }
  }
  const deleteExtra = async (id: string) => {
    if (!confirm('¿Eliminar este extra?')) return
    await fetch(`/api/estructura/room-extras/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Price CRUD ──────────────────────────────────────────────────────────
  const openNewPrice = (roomId: string) => { setPricingRoomId(roomId); setEditingPrice(null); setShowPriceModal(true) }
  const openEditPrice = (roomId: string, p: RoomPrice) => { setPricingRoomId(roomId); setEditingPrice(p); setShowPriceModal(true) }
  const savePrice = async (data: Partial<RoomPrice>) => {
    if (editingPrice) {
      const res = await fetch(`/api/estructura/room-prices/${editingPrice.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) { setShowPriceModal(false); load() }
    } else {
      const res = await fetch('/api/estructura/room-prices', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, room_type_id: pricingRoomId }),
      })
      if (res.ok) { setShowPriceModal(false); load() }
    }
  }
  const deletePrice = async (id: string) => {
    if (!confirm('¿Eliminar esta tarifa?')) return
    await fetch(`/api/estructura/room-prices/${id}`, { method: 'DELETE' })
    load()
  }

  // ── Block CRUD ──────────────────────────────────────────────────────────
  const openNewBlock = () => { setEditingBlock(null); setShowBlockModal(true) }
  const openEditBlock = (b: RoomBlock) => { setEditingBlock(b); setShowBlockModal(true) }
  const saveBlock = async (data: Partial<RoomBlock>) => {
    if (editingBlock) {
      const res = await fetch(`/api/estructura/room-blocks/${editingBlock.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) { setShowBlockModal(false); load() }
    } else {
      const res = await fetch('/api/estructura/room-blocks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      if (res.ok) { setShowBlockModal(false); load() }
    }
  }
  const deleteBlock = async (id: string) => {
    if (!confirm('¿Eliminar este bloqueo?')) return
    await fetch(`/api/estructura/room-blocks/${id}`, { method: 'DELETE' })
    load()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)' }}>Cargando alojamiento…</div>

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--ivory)', marginBottom: 16 }}>
        {([
          { key: 'rooms', label: 'Habitaciones', count: roomTypes.length, Icon: BedDouble },
          { key: 'extras', label: 'Extras', count: extras.length, Icon: Coffee },
          { key: 'calendar', label: 'Calendario', count: blocks.length, Icon: CalendarDays },
        ] as const).map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--charcoal)' : 'var(--warm-gray)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.key ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: -2, transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
            }}>
            <t.Icon size={14} />
            {t.label}
            {t.count > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: tab === t.key ? 'var(--gold)' : 'var(--cream)', color: tab === t.key ? '#fff' : 'var(--warm-gray)', border: tab === t.key ? 'none' : '1px solid var(--ivory)' }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* TAB ROOMS */}
      {tab === 'rooms' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <BedDouble size={15} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)' }}>Tipos de habitación</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewRoom} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Nuevo tipo
            </button>
          </div>

          {roomTypes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#fff', border: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <BedDouble size={24} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin habitaciones todavía</div>
              <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 22, maxWidth: 360, margin: '0 auto 22px', lineHeight: 1.5 }}>
                Crea tipos de habitación con su inventario y precios por temporada.
              </div>
              <button className="btn btn-primary" onClick={openNewRoom} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} /> Crear primer tipo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roomTypes.map(r => (
                <div key={r.id} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 12, padding: 14, opacity: r.is_active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {r.photo_urls && r.photo_urls[0] ? (
                      <img src={r.photo_urls[0]} alt={r.name} style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 80, height: 80, borderRadius: 8, background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ImageIcon size={22} style={{ color: 'var(--warm-gray)', opacity: .5 }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--charcoal)' }}>{r.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 20, background: 'var(--cream)', color: 'var(--warm-gray)', border: '1px solid var(--ivory)' }}>{r.total_quantity} disponibles</span>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {r.capacity_persons} personas</span>
                        {r.bed_config && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>· {r.bed_config}</span>}
                      </div>
                      {r.description && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 6 }}>{r.description}</div>}
                      {r.features && r.features.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          {r.features.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--cream)', color: 'var(--espresso)', border: '1px solid var(--ivory)' }}>{f.label}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                        {(r.prices ?? []).length === 0 ? (
                          <button onClick={() => openNewPrice(r.id)} style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--warm-gray)', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Plus size={11} /> Añadir tarifa
                          </button>
                        ) : (
                          <>
                            {(r.prices ?? []).map(p => (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--warm-gray)' }}>
                                <span style={{ minWidth: 130 }}>{p.date_from} → {p.date_to}</span>
                                <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{p.price_per_night}€/noche</span>
                                {p.min_nights && p.min_nights > 1 && <span>· min {p.min_nights} noches</span>}
                                <button onClick={() => openEditPrice(r.id, p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }}><Pencil size={10} /></button>
                                <button onClick={() => deletePrice(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BC5249', padding: 2 }}><X size={10} /></button>
                              </div>
                            ))}
                            <button onClick={() => openNewPrice(r.id)} style={{ alignSelf: 'flex-start', background: 'none', border: '1px dashed var(--ivory)', borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--warm-gray)', padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Plus size={11} /> Añadir tarifa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button onClick={() => openEditRoom(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }} title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => deleteRoom(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BC5249', padding: 4 }} title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB EXTRAS */}
      {tab === 'extras' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coffee size={15} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)' }}>Extras</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openNewExtra} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Nuevo extra
            </button>
          </div>

          {extras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--warm-gray)', fontSize: 13 }}>
              Sin extras. Añade desayuno, parking, cama extra, etc.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {extras.map(e => (
                <div key={e.id} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--charcoal)' }}>{e.name}</span>
                      {e.is_default_included && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--gold)', color: '#fff', fontWeight: 700 }}>INCLUIDO</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{e.price}€ {PRICING_UNIT_LABELS[e.pricing_unit]}{e.applies_to_room_types && e.applies_to_room_types.length > 0 ? ` · solo ${e.applies_to_room_types.length} tipo(s)` : ' · todos los tipos'}</div>
                    {e.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{e.description}</div>}
                  </div>
                  <button onClick={() => openEditExtra(e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}><Pencil size={14} /></button>
                  <button onClick={() => deleteExtra(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BC5249', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CALENDAR */}
      {tab === 'calendar' && (
        <CalendarTab
          month={calendarMonth} setMonth={setCalendarMonth}
          roomTypes={roomTypes} blocks={blocks}
          onNewBlock={openNewBlock} onEditBlock={openEditBlock} onDeleteBlock={deleteBlock}
        />
      )}

      {/* MODALS */}
      {showRoomModal && (
        <RoomModal initial={editingRoom} onClose={() => setShowRoomModal(false)} onSave={saveRoom} />
      )}
      {showExtraModal && (
        <ExtraModal initial={editingExtra} roomTypes={roomTypes} onClose={() => setShowExtraModal(false)} onSave={saveExtra} />
      )}
      {showPriceModal && pricingRoomId && (
        <PriceModal initial={editingPrice} onClose={() => setShowPriceModal(false)} onSave={savePrice} />
      )}
      {showBlockModal && (
        <BlockModal initial={editingBlock} roomTypes={roomTypes} onClose={() => setShowBlockModal(false)} onSave={saveBlock} />
      )}
    </div>
  )
}

// ── Calendar tab ──────────────────────────────────────────────────────────

function CalendarTab({ month, setMonth, roomTypes, blocks, onNewBlock, onEditBlock, onDeleteBlock }: {
  month: Date
  setMonth: (d: Date) => void
  roomTypes: RoomType[]
  blocks: RoomBlock[]
  onNewBlock: () => void
  onEditBlock: (b: RoomBlock) => void
  onDeleteBlock: (id: string) => void
}) {
  const monthName = month.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7  // Monday=0

  const ymd = (d: Date) => d.toISOString().slice(0, 10)

  // For each day, calculate blocked total per room type
  const getBlockedOnDay = (day: number, roomTypeId: string) => {
    const dateStr = ymd(new Date(month.getFullYear(), month.getMonth(), day))
    return blocks
      .filter(b => b.room_type_id === roomTypeId && b.date_from <= dateStr && b.date_to >= dateStr)
      .reduce((sum, b) => sum + b.quantity_blocked, 0)
  }
  const getDayBlocks = (day: number) => {
    const dateStr = ymd(new Date(month.getFullYear(), month.getMonth(), day))
    return blocks.filter(b => b.date_from <= dateStr && b.date_to >= dateStr)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: 5, display: 'flex' }}><ChevronLeft size={14} /></button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', textTransform: 'capitalize', minWidth: 150, textAlign: 'center' }}>{monthName}</span>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ background: 'none', border: '1px solid var(--ivory)', borderRadius: 6, cursor: 'pointer', padding: 5, display: 'flex' }}><ChevronRight size={14} /></button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onNewBlock} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Bloquear inventario
        </button>
      </div>

      {roomTypes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--warm-gray)', fontSize: 13 }}>
          Crea primero tipos de habitación para ver el calendario.
        </div>
      ) : (
        <>
          {/* Days header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {['L','M','X','J','V','S','D'].map((d, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textAlign: 'center', padding: 4 }}>{d}</div>
            ))}
          </div>
          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dayBlocks = getDayBlocks(day)
              const totalCapacity = roomTypes.reduce((s, r) => s + r.total_quantity, 0)
              const totalBlocked = roomTypes.reduce((s, r) => s + getBlockedOnDay(day, r.id), 0)
              const fullness = totalCapacity > 0 ? totalBlocked / totalCapacity : 0
              const bgColor = fullness === 0 ? '#fff' : fullness < 0.5 ? '#FFF8E7' : fullness < 1 ? '#FAE8D6' : '#F5D8D2'

              return (
                <div key={day} style={{ background: bgColor, border: '1px solid var(--ivory)', borderRadius: 6, padding: 6, minHeight: 70, fontSize: 11 }}>
                  <div style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{day}</div>
                  {dayBlocks.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayBlocks.slice(0, 2).map(b => {
                        const rt = roomTypes.find(r => r.id === b.room_type_id)
                        return (
                          <button key={b.id} onClick={() => onEditBlock(b)} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 3, cursor: 'pointer', padding: '1px 4px', fontSize: 9, textAlign: 'left', color: 'var(--charcoal)' }}>
                            {b.quantity_blocked} {rt?.name ?? '?'}
                          </button>
                        )
                      })}
                      {dayBlocks.length > 2 && <span style={{ fontSize: 9, color: 'var(--warm-gray)' }}>+{dayBlocks.length - 2} más</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 10, color: 'var(--warm-gray)', alignItems: 'center' }}>
            <span>Ocupación:</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#fff', border: '1px solid var(--ivory)', borderRadius: 2 }} />Libre</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#FFF8E7', border: '1px solid var(--ivory)', borderRadius: 2 }} />Bajo</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#FAE8D6', border: '1px solid var(--ivory)', borderRadius: 2 }} />Medio</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#F5D8D2', border: '1px solid var(--ivory)', borderRadius: 2 }} />Lleno</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Modals ────────────────────────────────────────────────────────────────

function RoomModal({ initial, onClose, onSave }: { initial: RoomType | null; onClose: () => void; onSave: (d: Partial<RoomType>) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [totalQuantity, setTotalQuantity] = useState(initial?.total_quantity ?? 1)
  const [capacityPersons, setCapacityPersons] = useState(initial?.capacity_persons ?? 2)
  const [bedConfig, setBedConfig] = useState(initial?.bed_config ?? '')
  const [features, setFeatures] = useState<string[]>((initial?.features ?? []).map(f => f.label))
  const [newFeature, setNewFeature] = useState('')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description.trim() || null,
      total_quantity: totalQuantity,
      capacity_persons: capacityPersons,
      bed_config: bedConfig.trim() || null,
      features: features.map(label => ({ label })),
    })
  }

  return (
    <Modal title={initial ? 'Editar habitación' : 'Nueva habitación'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} placeholder="Suite, Doble, Individual…" style={inputStyle} /></Field>
        <Field label="Descripción"><textarea value={description ?? ''} onChange={e => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cantidad total"><input type="number" min={1} value={totalQuantity} onChange={e => setTotalQuantity(parseInt(e.target.value) || 1)} style={inputStyle} /></Field>
          <Field label="Capacidad (personas)"><input type="number" min={1} value={capacityPersons} onChange={e => setCapacityPersons(parseInt(e.target.value) || 1)} style={inputStyle} /></Field>
        </div>
        <Field label="Configuración cama"><input value={bedConfig ?? ''} onChange={e => setBedConfig(e.target.value)} placeholder="1 cama matrimonio, 2 individuales…" style={inputStyle} /></Field>
        <Field label="Características">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            {features.map((f, i) => (
              <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'var(--cream)', border: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {f}
                <button onClick={() => setFeatures(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, display: 'flex' }}><X size={10} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Ej: Baño privado, Vista jardín, AC…" onKeyDown={e => { if (e.key === 'Enter' && newFeature.trim()) { setFeatures(prev => [...prev, newFeature.trim()]); setNewFeature('') } }} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => { if (newFeature.trim()) { setFeatures(prev => [...prev, newFeature.trim()]); setNewFeature('') } }} className="btn btn-ghost btn-sm">Añadir</button>
          </div>
        </Field>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} disabled={!name.trim()} />
    </Modal>
  )
}

function ExtraModal({ initial, roomTypes, onClose, onSave }: { initial: RoomExtra | null; roomTypes: RoomType[]; onClose: () => void; onSave: (d: Partial<RoomExtra>) => void }) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [pricingUnit, setPricingUnit] = useState<RoomExtra['pricing_unit']>(initial?.pricing_unit ?? 'per_night')
  const [price, setPrice] = useState(initial?.price ?? 0)
  const [appliesAll, setAppliesAll] = useState(!initial?.applies_to_room_types)
  const [appliesTo, setAppliesTo] = useState<string[]>(initial?.applies_to_room_types ?? [])
  const [isDefault, setIsDefault] = useState(initial?.is_default_included ?? false)

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      description: description?.trim() || null,
      pricing_unit: pricingUnit,
      price,
      applies_to_room_types: appliesAll ? null : appliesTo,
      is_default_included: isDefault,
    })
  }

  return (
    <Modal title={initial ? 'Editar extra' : 'Nuevo extra'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} placeholder="Desayuno, Parking, Cama extra…" style={inputStyle} /></Field>
        <Field label="Descripción"><input value={description ?? ''} onChange={e => setDescription(e.target.value)} style={inputStyle} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Unidad">
            <select value={pricingUnit} onChange={e => setPricingUnit(e.target.value as any)} style={inputStyle}>
              <option value="per_night">Por noche</option>
              <option value="per_person_per_night">Por persona/noche</option>
              <option value="per_person">Por persona</option>
              <option value="flat">Precio fijo</option>
            </select>
          </Field>
          <Field label="Precio (€)"><input type="number" min={0} step="0.01" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)} style={inputStyle} /></Field>
        </div>
        <Field label="Aplicable a">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="radio" checked={appliesAll} onChange={() => setAppliesAll(true)} /> Todos los tipos
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="radio" checked={!appliesAll} onChange={() => setAppliesAll(false)} /> Solo tipos específicos
            </label>
            {!appliesAll && (
              <div style={{ marginLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {roomTypes.map(rt => (
                  <label key={rt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={appliesTo.includes(rt.id)} onChange={() => setAppliesTo(prev => prev.includes(rt.id) ? prev.filter(x => x !== rt.id) : [...prev, rt.id])} />
                    {rt.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </Field>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} /> Incluido por defecto en la propuesta
        </label>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} disabled={!name.trim()} />
    </Modal>
  )
}

function PriceModal({ initial, onClose, onSave }: { initial: RoomPrice | null; onClose: () => void; onSave: (d: Partial<RoomPrice>) => void }) {
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? '')
  const [dateTo, setDateTo] = useState(initial?.date_to ?? '')
  const [pricePerNight, setPricePerNight] = useState(initial?.price_per_night ?? 0)
  const [minNights, setMinNights] = useState(initial?.min_nights ?? 1)
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSave = () => {
    if (!dateFrom || !dateTo) return
    onSave({
      date_from: dateFrom, date_to: dateTo,
      price_per_night: pricePerNight, min_nights: minNights,
      notes: notes?.trim() || null,
    })
  }

  return (
    <Modal title={initial ? 'Editar tarifa' : 'Nueva tarifa'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Desde"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Hasta"><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Precio por noche (€)"><input type="number" min={0} step="0.01" value={pricePerNight} onChange={e => setPricePerNight(parseFloat(e.target.value) || 0)} style={inputStyle} /></Field>
          <Field label="Mín. noches"><input type="number" min={1} value={minNights ?? 1} onChange={e => setMinNights(parseInt(e.target.value) || 1)} style={inputStyle} /></Field>
        </div>
        <Field label="Notas"><input value={notes ?? ''} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Field>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} disabled={!dateFrom || !dateTo} />
    </Modal>
  )
}

function BlockModal({ initial, roomTypes, onClose, onSave }: { initial: RoomBlock | null; roomTypes: RoomType[]; onClose: () => void; onSave: (d: Partial<RoomBlock>) => void }) {
  const [roomTypeId, setRoomTypeId] = useState(initial?.room_type_id ?? roomTypes[0]?.id ?? '')
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? '')
  const [dateTo, setDateTo] = useState(initial?.date_to ?? '')
  const [quantity, setQuantity] = useState(initial?.quantity_blocked ?? 1)
  const [reason, setReason] = useState(initial?.reason ?? 'manual')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const handleSave = () => {
    if (!roomTypeId || !dateFrom || !dateTo) return
    onSave({
      room_type_id: roomTypeId,
      date_from: dateFrom, date_to: dateTo,
      quantity_blocked: quantity, reason, notes: notes?.trim() || null,
    })
  }

  return (
    <Modal title={initial ? 'Editar bloqueo' : 'Bloquear inventario'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Tipo de habitación">
          <select value={roomTypeId} onChange={e => setRoomTypeId(e.target.value)} style={inputStyle}>
            {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} ({rt.total_quantity} disponibles)</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Desde"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} /></Field>
          <Field label="Hasta"><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cantidad a bloquear"><input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} style={inputStyle} /></Field>
          <Field label="Razón">
            <select value={reason} onChange={e => setReason(e.target.value)} style={inputStyle}>
              <option value="manual">Manual</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="reserva">Reserva</option>
              <option value="pms_externo">PMS externo</option>
            </select>
          </Field>
        </div>
        <Field label="Notas"><input value={notes ?? ''} onChange={e => setNotes(e.target.value)} style={inputStyle} /></Field>
      </div>
      <ModalActions onCancel={onClose} onSave={handleSave} disabled={!roomTypeId || !dateFrom || !dateTo} />
    </Modal>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--charcoal)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4, display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}

function ModalActions({ onCancel, onSave, disabled }: { onCancel: () => void; onSave: () => void; disabled?: boolean }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ivory)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancelar</button>
      <button className="btn btn-primary btn-sm" onClick={onSave} disabled={disabled}>Guardar</button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--ivory)', fontSize: 13, outline: 'none',
}
