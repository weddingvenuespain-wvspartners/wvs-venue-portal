'use client'

import { useEffect, useMemo, useState } from 'react'
import { BedDouble, Plus, Minus, Calendar, Coffee } from 'lucide-react'

type RoomType = {
  id: string
  name: string
  description: string | null
  total_quantity: number
  capacity_persons: number
  bed_config: string | null
  features: Array<{ icon?: string; label: string }>
  photo_urls: string[]
}

type RoomPrice = {
  id: string
  room_type_id: string
  date_from: string
  date_to: string
  price_per_night: number
  min_nights: number | null
}

type RoomExtra = {
  id: string
  name: string
  description: string | null
  pricing_unit: 'per_person_per_night' | 'per_night' | 'per_person' | 'flat'
  price: number
  applies_to_room_types: string[] | null
  is_default_included: boolean
}

type RoomBlock = {
  room_type_id: string
  date_from: string
  date_to: string
  quantity_blocked: number
}

type InventoryLimit = { room_type_id: string; max_quantity: number }

type Selection = {
  room_type_id: string
  check_in: string
  check_out: string
  quantity: number
  extras_selected: Array<{ extra_id: string; quantity: number }>
  computed_total: number | null
}

type LodgingData = {
  config_id: string
  room_types: RoomType[]
  prices: RoomPrice[]
  extras: RoomExtra[]
  blocks: RoomBlock[]
  inventory_limits: InventoryLimit[]
  selections: Selection[]
}

const PRICING_UNIT_LABELS: Record<string, string> = {
  per_person_per_night: 'por persona/noche',
  per_night:            'por noche',
  per_person:           'por persona',
  flat:                 'precio fijo',
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to   + 'T00:00:00')
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function priceForNight(prices: RoomPrice[], roomTypeId: string, dateStr: string): number {
  const p = prices.find(pr => pr.room_type_id === roomTypeId && pr.date_from <= dateStr && pr.date_to >= dateStr)
  return p?.price_per_night ?? 0
}

function totalForStay(prices: RoomPrice[], roomTypeId: string, from: string, to: string): number {
  let total = 0
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to   + 'T00:00:00')
  for (let d = new Date(a); d < b; d.setDate(d.getDate() + 1)) {
    total += priceForNight(prices, roomTypeId, d.toISOString().slice(0, 10))
  }
  return total
}

function availableFor(roomType: RoomType, from: string, to: string, blocks: RoomBlock[], inventoryLimits: InventoryLimit[]): number {
  const limit = inventoryLimits.find(l => l.room_type_id === roomType.id)
  const offered = limit?.max_quantity ?? roomType.total_quantity
  // Max blocked in date range
  const rel = blocks.filter(b => b.room_type_id === roomType.id && b.date_from <= to && b.date_to >= from)
  const maxBlocked = rel.reduce((m, b) => Math.max(m, b.quantity_blocked), 0)
  return Math.max(0, Math.min(offered, roomType.total_quantity - maxBlocked))
}

export default function LodgingSection({ data, proposalId, isPreview }: { data: LodgingData; proposalId: string; isPreview?: boolean }) {
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 2)

  // Initial state from existing selections (first selection drives dates)
  const initialFrom = data.selections[0]?.check_in ?? today.toISOString().slice(0, 10)
  const initialTo   = data.selections[0]?.check_out ?? tomorrow.toISOString().slice(0, 10)

  const [checkIn,  setCheckIn]  = useState(initialFrom)
  const [checkOut, setCheckOut] = useState(initialTo)

  // Quantities per room type
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const q: Record<string, number> = {}
    for (const s of data.selections) q[s.room_type_id] = s.quantity
    return q
  })

  // Selected extras (extra_id → quantity, simplified: 0/1 toggle for now)
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    for (const e of data.extras) if (e.is_default_included) m[e.id] = true
    // Apply persisted selection from first row
    const fromPersisted = data.selections[0]?.extras_selected ?? []
    for (const ex of fromPersisted) m[ex.extra_id] = ex.quantity > 0
    return m
  })

  const nights = daysBetween(checkIn, checkOut)

  const totalPersons = useMemo(() => {
    return data.room_types.reduce((sum, rt) => sum + (quantities[rt.id] ?? 0) * rt.capacity_persons, 0)
  }, [data.room_types, quantities])

  const roomsTotal = useMemo(() => {
    let total = 0
    for (const rt of data.room_types) {
      const q = quantities[rt.id] ?? 0
      if (q === 0) continue
      total += totalForStay(data.prices, rt.id, checkIn, checkOut) * q
    }
    return total
  }, [data.room_types, data.prices, quantities, checkIn, checkOut])

  const extrasTotal = useMemo(() => {
    let total = 0
    for (const e of data.extras) {
      if (!selectedExtras[e.id]) continue
      // If extra applies only to specific room types, count only those
      const appliesAll = !e.applies_to_room_types || e.applies_to_room_types.length === 0
      const affectedRooms = data.room_types.filter(rt => appliesAll || (e.applies_to_room_types ?? []).includes(rt.id))
      const qSum = affectedRooms.reduce((s, rt) => s + (quantities[rt.id] ?? 0), 0)
      const persons = affectedRooms.reduce((s, rt) => s + (quantities[rt.id] ?? 0) * rt.capacity_persons, 0)
      switch (e.pricing_unit) {
        case 'per_night':            total += e.price * qSum * nights; break
        case 'per_person_per_night': total += e.price * persons * nights; break
        case 'per_person':           total += e.price * persons; break
        case 'flat':                 total += qSum > 0 ? e.price : 0; break
      }
    }
    return total
  }, [data.extras, data.room_types, selectedExtras, quantities, nights])

  const grandTotal = roomsTotal + extrasTotal

  // Persist selection on change (debounced)
  useEffect(() => {
    if (isPreview) return
    const t = setTimeout(() => {
      const selections = data.room_types
        .filter(rt => (quantities[rt.id] ?? 0) > 0)
        .map(rt => ({
          room_type_id: rt.id,
          check_in: checkIn,
          check_out: checkOut,
          quantity: quantities[rt.id] ?? 0,
          extras_selected: Object.entries(selectedExtras).filter(([_, v]) => v).map(([extra_id]) => ({ extra_id, quantity: 1 })),
          computed_total: totalForStay(data.prices, rt.id, checkIn, checkOut) * (quantities[rt.id] ?? 0),
        }))
      fetch(`/api/proposals/${proposalId}/room-selections`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      }).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [quantities, checkIn, checkOut, selectedExtras, isPreview, proposalId, data.room_types, data.prices])

  const setQ = (rtId: string, delta: number, max: number) => {
    setQuantities(prev => {
      const cur = prev[rtId] ?? 0
      const next = Math.max(0, Math.min(max, cur + delta))
      return { ...prev, [rtId]: next }
    })
  }

  if (data.room_types.length === 0) return null

  return (
    <section id="lodging" style={{ padding: '60px 20px', background: 'var(--lodging-bg, #FBFAF7)' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <BedDouble size={22} style={{ color: 'var(--gold, #4A6B52)' }} />
          <h2 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--charcoal, #2A2A2A)' }}>Selecciona tu alojamiento</h2>
        </div>
        <p style={{ fontSize: 14, color: 'var(--warm-gray, #777)', marginBottom: 28 }}>Elige las habitaciones y la duración de la estancia.</p>

        {/* Date selector */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
          <Calendar size={18} style={{ color: 'var(--gold, #4A6B52)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal, #2A2A2A)' }}>Check-in</label>
            <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #E5E0D5', borderRadius: 6, fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal, #2A2A2A)' }}>Check-out</label>
            <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #E5E0D5', borderRadius: 6, fontSize: 13 }} />
          </div>
          <span style={{ fontSize: 13, color: 'var(--warm-gray, #777)', marginLeft: 'auto' }}>
            {nights} {nights === 1 ? 'noche' : 'noches'}
          </span>
        </div>

        {/* Room types */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
          {data.room_types.map(rt => {
            const available = availableFor(rt, checkIn, checkOut, data.blocks, data.inventory_limits)
            const stayTotal = totalForStay(data.prices, rt.id, checkIn, checkOut)
            const perNight = nights > 0 ? stayTotal / nights : 0
            const q = quantities[rt.id] ?? 0
            const subtotal = stayTotal * q

            return (
              <div key={rt.id} style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {rt.photo_urls && rt.photo_urls[0] ? (
                  <img src={rt.photo_urls[0]} alt={rt.name} style={{ width: 140, height: 110, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 140, height: 110, borderRadius: 8, background: 'var(--cream, #F5F0E8)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BedDouble size={32} style={{ color: 'var(--warm-gray, #777)', opacity: 0.4 }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--charcoal, #2A2A2A)' }}>{rt.name}</h3>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold, #4A6B52)' }}>
                      {perNight > 0 ? `${perNight.toFixed(0)}€/noche` : 'Sin tarifa'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray, #777)', marginBottom: 6 }}>
                    {rt.capacity_persons} personas{rt.bed_config ? ` · ${rt.bed_config}` : ''}
                  </div>
                  {rt.description && <div style={{ fontSize: 12, color: 'var(--warm-gray, #777)', marginBottom: 8 }}>{rt.description}</div>}
                  {rt.features && rt.features.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {rt.features.map((f, i) => (
                        <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'var(--cream, #F5F0E8)', color: 'var(--charcoal, #2A2A2A)' }}>{f.label}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--warm-gray, #777)' }}>Disponibles: <strong style={{ color: 'var(--charcoal, #2A2A2A)' }}>{available}</strong></span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--cream, #F5F0E8)', borderRadius: 8, padding: 2 }}>
                      <button type="button" onClick={() => setQ(rt.id, -1, available)} disabled={q === 0}
                        style={{ width: 28, height: 28, border: 'none', background: q > 0 ? '#fff' : 'transparent', borderRadius: 6, cursor: q > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: q > 0 ? 'var(--charcoal, #2A2A2A)' : 'var(--warm-gray, #777)', opacity: q > 0 ? 1 : 0.4 }}>
                        <Minus size={14} />
                      </button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--charcoal, #2A2A2A)' }}>{q}</span>
                      <button type="button" onClick={() => setQ(rt.id, 1, available)} disabled={q >= available}
                        style={{ width: 28, height: 28, border: 'none', background: q < available ? '#fff' : 'transparent', borderRadius: 6, cursor: q < available ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: q < available ? 'var(--charcoal, #2A2A2A)' : 'var(--warm-gray, #777)', opacity: q < available ? 1 : 0.4 }}>
                        <Plus size={14} />
                      </button>
                    </div>
                    {q > 0 && (
                      <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 700, color: 'var(--charcoal, #2A2A2A)' }}>{subtotal.toFixed(0)}€</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Extras */}
        {data.extras.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Coffee size={16} style={{ color: 'var(--gold, #4A6B52)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--charcoal, #2A2A2A)' }}>Extras</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.extras.map(e => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0' }}>
                  <input type="checkbox" checked={!!selectedExtras[e.id]} onChange={ev => setSelectedExtras(prev => ({ ...prev, [e.id]: ev.target.checked }))} />
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--charcoal, #2A2A2A)' }}>
                    <strong>{e.name}</strong>
                    <span style={{ color: 'var(--warm-gray, #777)', fontWeight: 400, marginLeft: 6 }}>{e.price}€ {PRICING_UNIT_LABELS[e.pricing_unit]}</span>
                    {e.description && <span style={{ display: 'block', fontSize: 11, color: 'var(--warm-gray, #777)', marginTop: 2 }}>{e.description}</span>}
                  </span>
                  {e.is_default_included && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--gold, #4A6B52)', color: '#fff', fontWeight: 700 }}>INCLUIDO</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div style={{ background: 'var(--charcoal, #2A2A2A)', color: '#fff', borderRadius: 12, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Total alojamiento ({nights} {nights === 1 ? 'noche' : 'noches'}, {totalPersons} {totalPersons === 1 ? 'persona' : 'personas'})</div>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>Habitaciones: {roomsTotal.toFixed(0)}€ · Extras: {extrasTotal.toFixed(0)}€</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{grandTotal.toFixed(0)}€</div>
        </div>
      </div>
    </section>
  )
}
