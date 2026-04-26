'use client'
import { X, Upload, Check, RefreshCw, AlertCircle } from 'lucide-react'
import type { SpaceGroup, VenueSpaceItem } from '@/lib/proposal-types'

type VenueZone = { id: string; name: string }

type Props = {
  venueZones: VenueZone[]
  groups: SpaceGroup[]
  onChange: (groups: SpaceGroup[]) => void
  uploadImage?: (file: File, folder: string) => Promise<string | null>
}

const addBtn: React.CSSProperties = {
  fontSize: 11, color: 'var(--gold)', background: 'none',
  border: '1px dashed var(--border)', borderRadius: 6,
  padding: '6px 10px', cursor: 'pointer', width: '100%',
}
const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--warm-gray)', padding: '2px 4px', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center',
}

// All spaces live in a single synthetic group for the multiple_independent
// model. We keep the data shape compatible with SpaceGroupSelector.
const SYNTHETIC_GROUP_NAME = 'Vuestros espacios'

function getGroup(groups: SpaceGroup[]): SpaceGroup {
  return groups[0] ?? { name: SYNTHETIC_GROUP_NAME, description: '', note: '', requires_selection: true, spaces: [] }
}

export default function MultipleZonesEditor({ venueZones, groups, onChange, uploadImage }: Props) {
  const group = getGroup(groups)
  const spaces = group.spaces ?? []

  // Diff between estructura zones and current spaces (linked by zone_id)
  const linkedZoneIds = new Set(spaces.map(s => s.zone_id).filter(Boolean) as string[])
  const missingZones = venueZones.filter(z => !linkedZoneIds.has(z.id))
  const orphanSpaces = spaces.filter(s => s.zone_id && !venueZones.some(z => z.id === s.zone_id))

  const persist = (newSpaces: VenueSpaceItem[]) => {
    onChange([{ ...group, name: group.name || SYNTHETIC_GROUP_NAME, requires_selection: true, spaces: newSpaces }])
  }

  const syncFromEstructura = () => {
    // Add new zones at the end, refresh names of existing linked spaces
    const next: VenueSpaceItem[] = spaces.map(s => {
      if (!s.zone_id) return s
      const venueZone = venueZones.find(z => z.id === s.zone_id)
      return venueZone ? { ...s, name: venueZone.name } : s
    })
    for (const z of missingZones) {
      next.push({ zone_id: z.id, name: z.name, description: '', price: '' })
    }
    persist(next)
  }

  const updateSpace = (index: number, patch: Partial<VenueSpaceItem>) => {
    persist(spaces.map((s, i) => i === index ? { ...s, ...patch } : s))
  }

  const removeSpace = (index: number) => {
    persist(spaces.filter((_, i) => i !== index))
  }

  const handleUpload = async (index: number, file: File) => {
    if (!uploadImage) return
    const url = await uploadImage(file, 'spaces')
    if (url) updateSpace(index, { photo_url: url })
  }

  // Empty state — no zones in estructura
  if (venueZones.length === 0) {
    return (
      <div style={{ padding: '12px 14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 7, fontSize: 12, color: '#9a3412', lineHeight: 1.55, display: 'flex', gap: 8 }}>
        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1, color: '#ea580c' }} />
        <div style={{ flex: 1 }}>
          <strong>No hay zonas definidas</strong> en tu estructura comercial.
          <div style={{ marginTop: 4 }}>Ve a <a href="/estructura" style={{ color: '#c2410c', fontWeight: 600 }}>Estructura comercial → Zonas del venue</a> para añadirlas. Aparecerán aquí automáticamente.</div>
        </div>
      </div>
    )
  }

  const allSynced = missingZones.length === 0 && orphanSpaces.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Sync banner */}
      <div style={{
        padding: '8px 12px', borderRadius: 7,
        background: allSynced ? '#f0fdf4' : '#eff6ff',
        border: `1px solid ${allSynced ? '#bbf7d0' : '#bfdbfe'}`,
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, lineHeight: 1.5,
      }}>
        {allSynced ? (
          <>
            <Check size={13} style={{ color: '#166534', flexShrink: 0 }} />
            <span style={{ color: '#166534', flex: 1 }}>Sincronizado con <a href="/estructura" style={{ color: '#15803d', fontWeight: 600 }}>estructura comercial</a> ({venueZones.length} {venueZones.length === 1 ? 'zona' : 'zonas'})</span>
          </>
        ) : (
          <>
            <RefreshCw size={13} style={{ color: '#1d4ed8', flexShrink: 0 }} />
            <span style={{ color: '#1e3a8a', flex: 1 }}>
              {missingZones.length > 0 && <>{missingZones.length} {missingZones.length === 1 ? 'zona nueva' : 'zonas nuevas'} en estructura</>}
              {missingZones.length > 0 && orphanSpaces.length > 0 && ' · '}
              {orphanSpaces.length > 0 && <>{orphanSpaces.length} sin enlazar</>}
            </span>
            <button type="button" onClick={syncFromEstructura}
              style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, background: '#1d4ed8', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Sincronizar
            </button>
          </>
        )}
      </div>

      {/* Group settings (only if there are spaces) */}
      {spaces.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', background: 'var(--cream)', borderRadius: 7, border: '1px solid var(--border)' }}>
          <input className="form-input" style={{ fontSize: 12 }}
            placeholder="Texto introductorio (ej. Elige el espacio que más os encaje)"
            value={group.description ?? ''} onChange={e => onChange([{ ...group, description: e.target.value, spaces }])} />
          <input className="form-input" style={{ fontSize: 11 }}
            placeholder="Nota pequeña (opcional, ej. *Cada zona tiene capacidades distintas*)"
            value={group.note ?? ''} onChange={e => onChange([{ ...group, note: e.target.value, spaces }])} />
        </div>
      )}

      {/* Spaces list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {spaces.map((s, i) => {
          const isLinked = !!s.zone_id
          const isOrphan = isLinked && !venueZones.some(z => z.id === s.zone_id)
          return (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 7, padding: 10, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>
                  {s.name || <em style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>Sin nombre</em>}
                  {isLinked && !isOrphan && (
                    <span style={{ marginLeft: 8, fontSize: 9, color: '#15803d', background: '#dcfce7', padding: '1px 6px', borderRadius: 8, fontWeight: 600, letterSpacing: '.04em' }}>ESTRUCTURA</span>
                  )}
                  {isOrphan && (
                    <span style={{ marginLeft: 8, fontSize: 9, color: '#9a3412', background: '#fed7aa', padding: '1px 6px', borderRadius: 8, fontWeight: 600, letterSpacing: '.04em' }}>HUÉRFANO</span>
                  )}
                </div>
                <button type="button" style={removeBtn} onClick={() => removeSpace(i)} title="Quitar"><X size={13} /></button>
              </div>

              {!isLinked && (
                <input className="form-input" style={{ fontSize: 12 }}
                  placeholder="Nombre *" value={s.name ?? ''} onChange={e => updateSpace(i, { name: e.target.value })} />
              )}

              <input className="form-input" style={{ fontSize: 12 }}
                placeholder="Descripción breve (opcional)"
                value={s.description ?? ''} onChange={e => updateSpace(i, { description: e.target.value })} />

              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" style={{ fontSize: 12, flex: 1 }}
                  placeholder="Precio (ej. 5.000€)"
                  value={s.price ?? ''} onChange={e => updateSpace(i, { price: e.target.value })} />
                <input className="form-input" style={{ fontSize: 12, width: 90, flexShrink: 0 }}
                  type="number" placeholder="Cap. máx."
                  value={s.capacity_max ?? ''} onChange={e => updateSpace(i, { capacity_max: e.target.value ? Number(e.target.value) : undefined })} />
              </div>

              {/* Photo */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {s.photo_url ? (
                  <>
                    <img src={s.photo_url} alt="" style={{ width: 80, height: 54, objectFit: 'cover', borderRadius: 5, border: '1px solid var(--border)' }} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => updateSpace(i, { photo_url: undefined })}>Quitar</button>
                  </>
                ) : uploadImage ? (
                  <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                    <Upload size={11} /> Subir foto
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => e.target.files?.[0] && handleUpload(i, e.target.files[0])} />
                  </label>
                ) : (
                  <input className="form-input" style={{ fontSize: 12, flex: 1 }}
                    placeholder="URL imagen" value={s.photo_url ?? ''} onChange={e => updateSpace(i, { photo_url: e.target.value })} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty state — zones exist in estructura but not yet imported */}
      {spaces.length === 0 && (
        <button type="button" onClick={syncFromEstructura} style={addBtn}>
          + Importar {venueZones.length} {venueZones.length === 1 ? 'zona' : 'zonas'} de estructura comercial
        </button>
      )}
    </div>
  )
}
