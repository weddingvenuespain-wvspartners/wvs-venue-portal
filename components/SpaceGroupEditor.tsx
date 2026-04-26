'use client'
import { ChevronDown, X } from 'lucide-react'
import type { SpaceGroup, VenueSpaceItem } from '@/lib/proposal-types'
import { ImageUploader } from './ImageUploader'

type Props = {
  groups: SpaceGroup[]
  onChange: (groups: SpaceGroup[]) => void
  uploadImage?: (file: File, folder: string) => Promise<string | null>
}

const addBtn: React.CSSProperties = {
  fontSize: 11, color: 'var(--gold)', background: 'none',
  border: '1px dashed var(--border)', borderRadius: 6,
  padding: '5px 10px', cursor: 'pointer', marginTop: 6, width: '100%',
}
const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--warm-gray)', padding: '2px 4px', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center',
}

function newGroup(): SpaceGroup {
  return { name: '', description: '', note: '', requires_selection: true, spaces: [] }
}
function newSpace(): VenueSpaceItem {
  return { name: '', description: '', price: '', price_label: '' }
}

export default function SpaceGroupEditor({ groups, onChange, uploadImage }: Props) {
  const updateGroup = (gi: number, patch: Partial<SpaceGroup>) => {
    onChange(groups.map((g, i) => i === gi ? { ...g, ...patch } : g))
  }
  const removeGroup = (gi: number) => onChange(groups.filter((_, i) => i !== gi))

  const updateSpace = (gi: number, si: number, patch: Partial<VenueSpaceItem>) => {
    const spaces = groups[gi].spaces.map((s, i) => i === si ? { ...s, ...patch } : s)
    updateGroup(gi, { spaces })
  }
  const removeSpace = (gi: number, si: number) => {
    updateGroup(gi, { spaces: groups[gi].spaces.filter((_, i) => i !== si) })
  }

  const handlePhotoUpload = async (gi: number, si: number, file: File) => {
    if (!uploadImage) return
    const url = await uploadImage(file, 'space-groups')
    if (url) updateSpace(gi, si, { photo_url: url })
  }

  return (
    <div>
      {groups.map((g, gi) => (
        <details key={gi} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
          <summary style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', fontWeight: 600, background: 'var(--cream)', listStyle: 'none' }}>
            <ChevronDown size={11} color="var(--warm-gray)" />
            <span style={{ flex: 1 }}>{g.name || <em style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>Nuevo grupo</em>}</span>
            <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontWeight: 400, marginRight: 6 }}>{g.spaces.length} espacio{g.spaces.length !== 1 ? 's' : ''}</span>
            <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeGroup(gi) }}><X size={13} /></button>
          </summary>

          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Group meta */}
            <input className="form-input" placeholder="Nombre del grupo *  (ej. Zona de ceremonia)" style={{ fontSize: 12 }}
              value={g.name} onChange={e => updateGroup(gi, { name: e.target.value })} />
            <input className="form-input" placeholder="Descripción breve (opcional)" style={{ fontSize: 12 }}
              value={g.description ?? ''} onChange={e => updateGroup(gi, { description: e.target.value })} />
            <input className="form-input" placeholder="Nota interna visible al cliente (ej. Elige un espacio según el nº de invitados)" style={{ fontSize: 12 }}
              value={g.note ?? ''} onChange={e => updateGroup(gi, { note: e.target.value })} />

            {/* requires_selection toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--charcoal)', cursor: 'pointer', userSelect: 'none' }}>
              <div onClick={() => updateGroup(gi, { requires_selection: !g.requires_selection })}
                style={{ width: 32, height: 18, borderRadius: 9, background: g.requires_selection !== false ? 'var(--gold)' : '#d1c9b8', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: g.requires_selection !== false ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
              El cliente debe elegir un espacio de este grupo
            </label>

            {/* Spaces */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 6 }}>
                Espacios del grupo
              </div>

              {g.spaces.map((s, si) => (
                <details key={si} style={{ border: '1px solid var(--border)', borderRadius: 7, marginBottom: 6, overflow: 'hidden' }}>
                  <summary style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--charcoal)', background: '#f9f7f3', listStyle: 'none' }}>
                    <ChevronDown size={10} color="var(--warm-gray)" />
                    {s.photo_url && <img src={s.photo_url} alt="" style={{ width: 32, height: 24, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontWeight: 500 }}>{s.name || <em style={{ color: 'var(--warm-gray)', fontWeight: 400 }}>Nuevo espacio</em>}</span>
                    {s.price && <span style={{ fontSize: 10, color: 'var(--warm-gray)', marginRight: 6 }}>{s.price}</span>}
                    <button type="button" style={removeBtn} onClick={e => { e.preventDefault(); e.stopPropagation(); removeSpace(gi, si) }}><X size={11} /></button>
                  </summary>

                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input className="form-input" placeholder="Nombre del espacio *" style={{ fontSize: 12 }}
                      value={s.name} onChange={e => updateSpace(gi, si, { name: e.target.value })} />
                    <input className="form-input" placeholder="Descripción breve" style={{ fontSize: 12 }}
                      value={s.description ?? ''} onChange={e => updateSpace(gi, si, { description: e.target.value })} />

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" placeholder="Precio  (ej. +500€)" style={{ fontSize: 12, flex: 1 }}
                        value={s.price ?? ''} onChange={e => updateSpace(gi, si, { price: e.target.value })} />
                      <input className="form-input" placeholder="Etiqueta  (ej. hasta 80 pax)" style={{ fontSize: 12, flex: 1 }}
                        value={s.price_label ?? ''} onChange={e => updateSpace(gi, si, { price_label: e.target.value })} />
                      <input className="form-input" type="number" placeholder="Máx. pax" style={{ fontSize: 12, width: 90, flexShrink: 0 }}
                        value={s.capacity_max ?? ''} onChange={e => updateSpace(gi, si, { capacity_max: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>

                    {/* Photo */}
                    {uploadImage && (
                      <div style={{ width: 100 }}>
                        <ImageUploader
                          compact
                          value={s.photo_url ?? null}
                          aspectRatio={4 / 3}
                          label="Foto"
                          alt={s.name || 'Espacio'}
                          onUpload={(f) => handlePhotoUpload(gi, si, f)}
                          onRemove={() => updateSpace(gi, si, { photo_url: undefined })}
                        />
                      </div>
                    )}
                  </div>
                </details>
              ))}

              <button type="button" style={addBtn} onClick={() => updateGroup(gi, { spaces: [...g.spaces, newSpace()] })}>
                + Añadir espacio
              </button>
            </div>
          </div>
        </details>
      ))}

      <button type="button" style={addBtn} onClick={() => onChange([...groups, newGroup()])}>
        + Añadir grupo de espacios
      </button>
    </div>
  )
}
