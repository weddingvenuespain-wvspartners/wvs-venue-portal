'use client'
import { X, Check, RefreshCw, AlertCircle, Users, ChevronDown, ChevronRight } from 'lucide-react'
import type { VenueSpaceGroup, SpaceGroup, VenueSpaceItem } from '@/lib/proposal-types'
import { useState } from 'react'
import { ImageUploader } from './ImageUploader'

type Props = {
  venueSpaceGroups: VenueSpaceGroup[]
  groups: SpaceGroup[]
  onChange: (groups: SpaceGroup[]) => void
  uploadImage?: (file: File, folder: string) => Promise<string | null>
  guestCount?: number
}

const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--warm-gray)', padding: '2px 4px', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center',
}

function capacityOk(space: { capacity_min?: number; capacity_max?: number }, guests: number | undefined): boolean {
  if (!guests) return true
  if (space.capacity_min && guests < space.capacity_min) return false
  if (space.capacity_max && guests > space.capacity_max) return false
  return true
}

export default function MultipleZonesEditor({ venueSpaceGroups, groups, onChange, uploadImage, guestCount }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(venueSpaceGroups.map(g => g.id)))

  if (venueSpaceGroups.length === 0) {
    return (
      <div style={{ padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 7, fontSize: 12, color: '#9a3412', lineHeight: 1.55, display: 'flex', gap: 8 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1, color: '#ea580c' }} />
        <div style={{ flex: 1 }}>
          <strong>No hay grupos de espacios definidos</strong> en tu estructura comercial.
          <div style={{ marginTop: 4 }}>Ve a <a href="/estructura" style={{ color: '#c2410c', fontWeight: 600 }}>Estructura comercial → Grupos y espacios</a> para configurarlos.</div>
        </div>
      </div>
    )
  }

  // ── Sync helpers ──────────────────────────────────────────────────────────────

  // Find the proposal SpaceGroup linked to a VenueSpaceGroup (by group_id)
  const findProposalGroup = (venueGroupId: string): SpaceGroup | undefined =>
    groups.find(g => g.group_id === venueGroupId)

  // Find a VenueSpaceItem inside a SpaceGroup linked to a VenueSpace (by zone_id)
  const findProposalSpace = (sg: SpaceGroup, venueSpaceId: string): VenueSpaceItem | undefined =>
    sg.spaces.find(s => s.zone_id === venueSpaceId)

  // Calculate sync status per venue group
  const syncStatus = venueSpaceGroups.map(vg => {
    const pg = findProposalGroup(vg.id)
    const missingSpaces = vg.spaces.filter(vs => !pg || !findProposalSpace(pg, vs.id))
    return { venueGroupId: vg.id, missing: missingSpaces.length }
  })
  const totalMissing = syncStatus.reduce((acc, s) => acc + s.missing, 0)
  const allSynced = totalMissing === 0 && venueSpaceGroups.every(vg => !!findProposalGroup(vg.id))

  const syncAll = () => {
    const next: SpaceGroup[] = venueSpaceGroups.map(vg => {
      const existing = findProposalGroup(vg.id)
      const existingSpaces = existing?.spaces ?? []

      const spaces: VenueSpaceItem[] = vg.spaces.map(vs => {
        const found = existingSpaces.find(s => s.zone_id === vs.id)
        if (found) return { ...found, name: vs.name, capacity_min: vs.capacity_min, capacity_max: vs.capacity_max }
        return { zone_id: vs.id, name: vs.name, description: vs.description ?? '', price: vs.price ?? '', capacity_min: vs.capacity_min, capacity_max: vs.capacity_max }
      })

      return {
        group_id: vg.id,
        name: existing?.name ?? vg.name,
        description: existing?.description ?? '',
        note: existing?.note ?? '',
        selection_mode: vg.selection_mode,
        pick_n_min: vg.pick_n_min,
        pick_n_max: vg.pick_n_max,
        pricing_mode: vg.pricing_mode ?? 'per_space',
        base_price: existing?.base_price ?? vg.base_price ?? '',
        spaces,
      }
    })
    onChange(next)
  }

  // ── Mutation helpers ──────────────────────────────────────────────────────────

  const updateGroup = (groupId: string, patch: Partial<SpaceGroup>) => {
    onChange(groups.map(g => g.group_id === groupId ? { ...g, ...patch } : g))
  }

  const updateSpace = (groupId: string, zoneId: string, patch: Partial<VenueSpaceItem>) => {
    onChange(groups.map(g => {
      if (g.group_id !== groupId) return g
      return { ...g, spaces: g.spaces.map(s => s.zone_id === zoneId ? { ...s, ...patch } : s) }
    }))
  }

  const removeSpace = (groupId: string, zoneId: string) => {
    onChange(groups.map(g => {
      if (g.group_id !== groupId) return g
      return { ...g, spaces: g.spaces.filter(s => s.zone_id !== zoneId) }
    }))
  }

  const handleUpload = async (groupId: string, zoneId: string, file: File) => {
    if (!uploadImage) return
    const url = await uploadImage(file, 'spaces')
    if (url) updateSpace(groupId, zoneId, { photo_url: url })
  }

  const SELECTION_LABELS: Record<string, string> = { pick_one: 'Elegir 1', pick_n: 'Elegir N', optional: 'Opcional' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Global sync banner */}
      <div style={{ padding: '8px 12px', borderRadius: 7, background: allSynced ? '#f0fdf4' : '#eff6ff', border: `1px solid ${allSynced ? '#bbf7d0' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
        {allSynced ? (
          <>
            <Check size={13} style={{ color: '#166534', flexShrink: 0 }} />
            <span style={{ color: '#166534', flex: 1 }}>
              Sincronizado con <a href="/estructura" style={{ color: '#15803d', fontWeight: 600 }}>estructura comercial</a> ({venueSpaceGroups.length} {venueSpaceGroups.length === 1 ? 'grupo' : 'grupos'})
            </span>
          </>
        ) : (
          <>
            <RefreshCw size={13} style={{ color: '#1d4ed8', flexShrink: 0 }} />
            <span style={{ color: '#1e3a8a', flex: 1 }}>
              {totalMissing} {totalMissing === 1 ? 'espacio nuevo' : 'espacios nuevos'} en estructura
            </span>
            <button type="button" onClick={syncAll}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Sincronizar
            </button>
          </>
        )}
      </div>

      {/* Empty state: groups defined in estructura but none imported yet */}
      {groups.length === 0 && (
        <button type="button" onClick={syncAll}
          style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: '1px dashed var(--border)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', width: '100%' }}>
          + Importar {venueSpaceGroups.length} {venueSpaceGroups.length === 1 ? 'grupo' : 'grupos'} de estructura comercial
        </button>
      )}

      {/* Groups */}
      {venueSpaceGroups.map(vg => {
        const pg = findProposalGroup(vg.id)
        const isOpen = expanded.has(vg.id)
        const missingCount = vg.spaces.filter(vs => !pg || !findProposalSpace(pg, vs.id)).length

        return (
          <div key={vg.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {/* Group header */}
            <div style={{ background: 'var(--cream)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setExpanded(prev => { const s = new Set(prev); isOpen ? s.delete(vg.id) : s.add(vg.id); return s })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 0, display: 'flex' }}>
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--charcoal)', flex: 1 }}>{vg.name}</span>
              <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', borderRadius: 8, padding: '2px 7px', fontWeight: 600 }}>
                {SELECTION_LABELS[vg.selection_mode] ?? vg.selection_mode}
              </span>
              {!pg && (
                <span style={{ fontSize: 10, color: '#9a3412', background: '#fed7aa', borderRadius: 8, padding: '2px 7px', fontWeight: 600 }}>NO IMPORTADO</span>
              )}
              {pg && missingCount > 0 && (
                <span style={{ fontSize: 10, color: '#1e3a8a', background: '#dbeafe', borderRadius: 8, padding: '2px 7px', fontWeight: 600 }}>{missingCount} nuevo{missingCount > 1 ? 's' : ''}</span>
              )}
            </div>

            {/* Group body */}
            {isOpen && pg && (
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Group-level text fields */}
                <input className="form-input" style={{ fontSize: 12 }}
                  placeholder="Texto introductorio del grupo (opcional)"
                  value={pg.description ?? ''} onChange={e => updateGroup(vg.id, { description: e.target.value })} />

                {(pg.pricing_mode ?? vg.pricing_mode) === 'group_base' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#F0FDFA', border: '1px solid #99F6E4', borderRadius: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#0F766E', whiteSpace: 'nowrap' }}>Precio base:</span>
                    <input className="form-input" placeholder="ej. 5.000€"
                      value={pg.base_price ?? ''} onChange={e => updateGroup(vg.id, { base_price: e.target.value })}
                      style={{ fontSize: 12, flex: 1 }} />
                    <span style={{ fontSize: 10, color: '#0F766E', fontStyle: 'italic' }}>los espacios actúan como suplemento</span>
                  </div>
                )}

                {/* Spaces */}
                {vg.spaces.map(vs => {
                  const ps = findProposalSpace(pg, vs.id)
                  const outOfRange = !capacityOk(vs, guestCount)

                  if (!ps) {
                    // Space exists in estructura but not yet imported in proposal
                    return (
                      <div key={vs.id} style={{ border: '1px dashed #BFDBFE', borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.7 }}>
                        <span style={{ fontSize: 12, color: 'var(--warm-gray)', flex: 1, fontStyle: 'italic' }}>{vs.name} — no importado</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                          const newSpace: VenueSpaceItem = { zone_id: vs.id, name: vs.name, description: vs.description ?? '', price: vs.price ?? '', capacity_min: vs.capacity_min, capacity_max: vs.capacity_max }
                          onChange(groups.map(g => g.group_id === vg.id ? { ...g, spaces: [...g.spaces, newSpace] } : g))
                        }}>+ Añadir</button>
                      </div>
                    )
                  }

                  return (
                    <div key={vs.id} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: 10, background: outOfRange ? '#FAFAF9' : 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6, opacity: outOfRange ? 0.65 : 1 }}>
                      {/* Space header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', flex: 1 }}>
                          {ps.name}
                          <span style={{ marginLeft: 6, fontSize: 9, color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: 8, fontWeight: 600 }}>ESTRUCTURA</span>
                        </span>
                        {(vs.capacity_min || vs.capacity_max) && (
                          <span style={{ fontSize: 10, color: outOfRange ? '#9a3412' : '#64748B', background: outOfRange ? '#fed7aa' : '#F1F5F9', borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                            <Users size={9} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                            {vs.capacity_min ?? '0'}–{vs.capacity_max ?? '∞'} pax
                            {outOfRange && guestCount && <span style={{ marginLeft: 4 }}>(vosotros: {guestCount})</span>}
                          </span>
                        )}
                        <button type="button" style={removeBtn} onClick={() => removeSpace(vg.id, vs.id)} title="Quitar de propuesta"><X size={13} /></button>
                      </div>

                      <input className="form-input" style={{ fontSize: 12 }}
                        placeholder="Descripción breve (opcional)"
                        value={ps.description ?? ''} onChange={e => updateSpace(vg.id, vs.id, { description: e.target.value })} />

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="form-input" style={{ fontSize: 12, flex: 1 }}
                          placeholder={(pg.pricing_mode ?? vg.pricing_mode) === 'group_base' ? 'Suplemento (ej. +500€)' : 'Precio (ej. 5.000€)'}
                          value={ps.price ?? ''} onChange={e => updateSpace(vg.id, vs.id, { price: e.target.value })} />
                      </div>

                      {/* Photo */}
                      {uploadImage ? (
                        <div style={{ width: 100 }}>
                          <ImageUploader
                            value={ps.photo_url ?? null}
                            aspectRatio={4 / 3}
                            label="Foto"
                            hint="Click o arrastra"
                            alt={vs.name}
                            onUpload={(f) => handleUpload(vg.id, vs.id, f)}
                            onRemove={() => updateSpace(vg.id, vs.id, { photo_url: undefined })}
                          />
                        </div>
                      ) : (
                        <input className="form-input" style={{ fontSize: 12, flex: 1 }}
                          placeholder="URL imagen" value={ps.photo_url ?? ''} onChange={e => updateSpace(vg.id, vs.id, { photo_url: e.target.value })} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Group not imported yet — show import button */}
            {isOpen && !pg && (
              <div style={{ padding: '10px 12px' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => {
                  const newGroup: SpaceGroup = {
                    group_id: vg.id, name: vg.name, description: '', note: '',
                    selection_mode: vg.selection_mode, pick_n_min: vg.pick_n_min, pick_n_max: vg.pick_n_max,
                    pricing_mode: vg.pricing_mode ?? 'per_space',
                    base_price: vg.base_price ?? '',
                    spaces: vg.spaces.map(vs => ({ zone_id: vs.id, name: vs.name, description: vs.description ?? '', price: vs.price ?? '', capacity_min: vs.capacity_min, capacity_max: vs.capacity_max })),
                  }
                  onChange([...groups, newGroup])
                }}>
                  + Importar grupo "{vg.name}"
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
