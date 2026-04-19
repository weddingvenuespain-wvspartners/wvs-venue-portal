'use client'
// ProposalMenuEditor — UI para configurar los menús, extras y aperitivos
// de una propuesta concreta. Se integra en el tab "Menús" de ProposalEditor.

import { useRef, useState } from 'react'
import { ChevronDown, X, GripVertical, Upload, FileText, Sparkles, Undo2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import type { SectionsData, Menu, MenuCourse, MenuExtra, AppetizerGroup } from '@/lib/proposal-types'

const CATEGORY_OPTIONS: Array<{ value: MenuExtra['category']; label: string }> = [
  { value: 'station',     label: 'Estaciones / Buffets' },
  { value: 'resopon',     label: 'Resopón' },
  { value: 'ceremony',    label: 'Ceremonia' },
  { value: 'music',       label: 'Música' },
  { value: 'audiovisual', label: 'Audiovisual' },
  { value: 'other',       label: 'Otros' },
]

const MODE_OPTIONS: Array<{ value: NonNullable<MenuCourse['mode']>; label: string }> = [
  { value: 'fixed',    label: 'Fijo (sin elección)' },
  { value: 'pick_one', label: 'Escoger 1' },
  { value: 'pick_n',   label: 'Escoger N' },
]

const itemCard: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 6, padding: 10,
  background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6,
}
const addBtn: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 500,
  color: 'var(--gold)', background: 'none', border: '1px dashed var(--gold)',
  borderRadius: 6, cursor: 'pointer', marginTop: 4,
}
const removeBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 6, background: 'none',
  border: '1px solid var(--border)', color: 'var(--warm-gray)',
  cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const sectionBlock: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
  padding: 16, marginBottom: 16,
}
const sectionHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 12, cursor: 'pointer', userSelect: 'none',
}
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', letterSpacing: '-0.01em',
}
const hint: React.CSSProperties = {
  fontSize: 11, color: 'var(--warm-gray)', marginBottom: 12, lineHeight: 1.5,
}

export default function ProposalMenuEditor({
  sections,
  setSections,
}: {
  sections: SectionsData
  setSections: React.Dispatch<React.SetStateAction<SectionsData>>
}) {
  const { user } = useAuth()
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['menus', 'extras', 'appetizers']))
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseMessage, setParseMessage] = useState<string | null>(null)
  const [undoSnapshot, setUndoSnapshot] = useState<{ prev: Menu[] | null; count: number } | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const menuPdfRefs = useRef<Record<number, HTMLInputElement | null>>({})

  // ─── PDF helpers ───────────────────────────────────────────────────────────

  const uploadPdf = async (file: File): Promise<string | null> => {
    if (!user) return null
    const supabase = createClient()
    const path = `${user.id}/menus/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    if (error) { setParseMessage(`Error al subir: ${error.message}`); return null }
    const { data } = supabase.storage.from('proposal-assets').getPublicUrl(path)
    return data.publicUrl
  }

  const handleImportPdf = async (file: File) => {
    setParseMessage(null)
    setUndoSnapshot(null)
    setParsing(true)
    try {
      const { parseMenuPdf } = await import('@/lib/pdf-menu-parser')
      const { menus: detected } = await parseMenuPdf(file)

      // Subir también el archivo a Storage y enlazarlo en cada menú detectado
      setUploadingPdf(true)
      const pdfUrl = await uploadPdf(file)
      setUploadingPdf(false)

      if (!detected.length) {
        setParseMessage('No se detectaron menús en el PDF. Puedes añadirlos manualmente.')
      } else {
        const enriched = detected.map(m => ({ ...m, pdf_url: pdfUrl ?? undefined }))
        const prev = sections.menus_override ?? null
        setSections(s => ({ ...s, menus_override: [...(s.menus_override ?? []), ...enriched] }))
        setUndoSnapshot({ prev, count: detected.length })
        setParseMessage(null)
      }
    } catch (err: any) {
      setParseMessage(`Error al leer el PDF: ${err?.message || 'desconocido'}`)
    } finally {
      setParsing(false)
    }
  }

  const handleUndoImport = () => {
    if (!undoSnapshot) return
    setSections(s => ({ ...s, menus_override: undoSnapshot.prev }))
    setUndoSnapshot(null)
    setParseMessage('Importación deshecha. Los menús anteriores se han restaurado.')
  }

  const handleAttachPdfToMenu = async (menuIdx: number, file: File) => {
    setUploadingPdf(true)
    const url = await uploadPdf(file)
    setUploadingPdf(false)
    if (url) updateMenu(menuIdx, { pdf_url: url })
  }

  const toggle = (k: string) => setOpenSections(s => {
    const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n
  })

  // ─── Menus helpers ─────────────────────────────────────────────────────────
  const menus: Menu[] = sections.menus_override ?? []
  const setMenus = (val: Menu[] | null) =>
    setSections(s => ({ ...s, menus_override: val }))

  const addMenu = () => setMenus([
    ...menus,
    { id: `m${Date.now()}`, name: '', price_per_person: '', courses: [] },
  ])
  const updateMenu = (i: number, patch: Partial<Menu>) =>
    setMenus(menus.map((m, idx) => idx === i ? { ...m, ...patch } : m))
  const removeMenu = (i: number) =>
    setMenus(menus.filter((_, idx) => idx !== i))

  const addCourse = (mi: number) =>
    updateMenu(mi, { courses: [...(menus[mi].courses ?? []), { label: '', mode: 'fixed', items: [] }] })
  const updateCourse = (mi: number, ci: number, patch: Partial<MenuCourse>) =>
    updateMenu(mi, { courses: (menus[mi].courses ?? []).map((c, idx) => idx === ci ? { ...c, ...patch } : c) })
  const removeCourse = (mi: number, ci: number) =>
    updateMenu(mi, { courses: (menus[mi].courses ?? []).filter((_, idx) => idx !== ci) })

  const addItem = (mi: number, ci: number) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci ? { ...c, items: [...c.items, { name: '' }] } : c)
    updateMenu(mi, { courses: newCourses })
  }
  const updateItem = (mi: number, ci: number, ii: number, patch: Partial<{ name: string; description: string; extra_price: string }>) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci
      ? { ...c, items: c.items.map((it, iii) => iii === ii ? { ...it, ...patch } : it) }
      : c)
    updateMenu(mi, { courses: newCourses })
  }
  const removeItem = (mi: number, ci: number, ii: number) => {
    const courses = menus[mi].courses ?? []
    const newCourses = courses.map((c, idx) => idx === ci
      ? { ...c, items: c.items.filter((_, iii) => iii !== ii) }
      : c)
    updateMenu(mi, { courses: newCourses })
  }

  // ─── Extras helpers ────────────────────────────────────────────────────────
  const extras: MenuExtra[] = sections.menu_extras_override ?? []
  const setExtras = (val: MenuExtra[] | null) =>
    setSections(s => ({ ...s, menu_extras_override: val }))
  const addExtra = () => setExtras([
    ...extras,
    { id: `x${Date.now()}`, category: 'station', name: '', price: '', price_type: 'per_person' },
  ])
  const updateExtra = (i: number, patch: Partial<MenuExtra>) =>
    setExtras(extras.map((e, idx) => idx === i ? { ...e, ...patch } : e))
  const removeExtra = (i: number) =>
    setExtras(extras.filter((_, idx) => idx !== i))

  // ─── Appetizers helpers ────────────────────────────────────────────────────
  const appetizers: AppetizerGroup[] = sections.appetizers_base_override ?? []
  const setAppetizers = (val: AppetizerGroup[] | null) =>
    setSections(s => ({ ...s, appetizers_base_override: val }))
  const addGroup = () => setAppetizers([...appetizers, { label: '', items: [] }])
  const updateGroup = (i: number, patch: Partial<AppetizerGroup>) =>
    setAppetizers(appetizers.map((g, idx) => idx === i ? { ...g, ...patch } : g))
  const removeGroup = (i: number) =>
    setAppetizers(appetizers.filter((_, idx) => idx !== i))
  const setGroupItemsText = (i: number, text: string) => {
    const items = text.split('\n').map(l => l.trim()).filter(Boolean)
    updateGroup(i, { items })
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--warm-gray)', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, lineHeight: 1.55 }}>
        Aquí configuráis los <strong>menús, extras y aperitivos</strong> que verán los invitados en el bloque interactivo al final de la propuesta. Lo que elijan se os enviará por email.
      </div>

      {/* ─── Importar desde PDF ─────────────────────────────────────────────── */}
      <div style={{ background: 'var(--cream)', border: '1px dashed var(--gold)', borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Sparkles size={18} style={{ color: 'var(--gold)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Importar desde PDF</div>
          <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
            Si tu menú ya está en PDF (con texto seleccionable), lo leemos e intentamos estructurar los cursos. Podrás revisar antes de guardar.
          </div>
        </div>
        <input ref={importInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleImportPdf(e.target.files[0])} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => importInputRef.current?.click()}
          disabled={parsing || uploadingPdf}
          style={{ flexShrink: 0 }}>
          <Upload size={12} /> {parsing ? 'Leyendo…' : uploadingPdf ? 'Subiendo…' : 'Subir PDF'}
        </button>
      </div>

      {undoSnapshot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '10px 12px', borderRadius: 8, marginBottom: 12, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d' }}>
          <span style={{ flex: 1 }}>
            ✓ Importados <strong>{undoSnapshot.count} menú{undoSnapshot.count > 1 ? 's' : ''}</strong>. Revisa y edita antes de guardar.
          </span>
          <button type="button" onClick={handleUndoImport}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #86efac', color: '#15803d', padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            <Undo2 size={12} /> Deshacer
          </button>
          <button type="button" onClick={() => setUndoSnapshot(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', padding: 2, display: 'flex' }}
            title="Cerrar">
            <X size={13} />
          </button>
        </div>
      )}

      {parseMessage && (
        <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 6, marginBottom: 12, background: parseMessage.startsWith('✓') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${parseMessage.startsWith('✓') ? '#86efac' : '#fcd34d'}`, color: parseMessage.startsWith('✓') ? '#15803d' : '#92400e' }}>
          {parseMessage}
        </div>
      )}

      {/* ─── MENÚS PRINCIPALES ──────────────────────────────────────────────── */}
      <div style={sectionBlock}>
        <div style={sectionHeader} onClick={() => toggle('menus')}>
          <span style={sectionTitle}>Menús principales ({menus.length})</span>
          <ChevronDown size={14} style={{ transform: openSections.has('menus') ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--warm-gray)' }} />
        </div>

        {openSections.has('menus') && (
          <div>
            <div style={hint}>
              Crea cada menú con sus platos. Para platos que la pareja debe elegir, usa <strong>"Escoger 1"</strong> o <strong>"Escoger N"</strong>.
            </div>

            {menus.map((m, mi) => (
              <div key={mi} style={{ ...itemCard, marginBottom: 12, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="form-input" placeholder="Nombre del menú (ej. Menú Bosque)" value={m.name}
                    onChange={e => updateMenu(mi, { name: e.target.value })} style={{ flex: 1 }} />
                  <input className="form-input" style={{ width: 130, flexShrink: 0 }}
                    placeholder="138€ +IVA" value={m.price_per_person}
                    onChange={e => updateMenu(mi, { price_per_person: e.target.value })} />
                  <button type="button" style={removeBtn} onClick={() => removeMenu(mi)} title="Eliminar menú"><X size={13} /></button>
                </div>
                <input className="form-input" placeholder="Subtítulo / descripción corta (opcional)" value={m.subtitle ?? ''}
                  onChange={e => updateMenu(mi, { subtitle: e.target.value })} />
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="form-input" type="number" placeholder="Mín. invitados (opc.)" value={m.min_guests ?? ''}
                    onChange={e => updateMenu(mi, { min_guests: e.target.value ? parseInt(e.target.value) : undefined })}
                    style={{ width: 180 }} />
                  {m.pdf_url ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--cream)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <FileText size={13} style={{ color: 'var(--gold)' }} />
                      <a href={m.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--charcoal)', textDecoration: 'none', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        PDF adjunto
                      </a>
                      <button type="button" onClick={() => updateMenu(mi, { pdf_url: undefined })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 2 }}><X size={11} /></button>
                    </div>
                  ) : (
                    <>
                      <input ref={el => { menuPdfRefs.current[mi] = el }} type="file" accept="application/pdf" style={{ display: 'none' }}
                        onChange={e => e.target.files?.[0] && handleAttachPdfToMenu(mi, e.target.files[0])} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => menuPdfRefs.current[mi]?.click()}
                        disabled={uploadingPdf} style={{ flexShrink: 0 }}>
                        <Upload size={11} /> Adjuntar PDF
                      </button>
                    </>
                  )}
                </div>

                {/* Cursos */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Cursos / Platos
                  </div>

                  {(m.courses ?? []).map((c, ci) => (
                    <div key={ci} style={{ background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--border)', padding: 10, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <GripVertical size={13} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                        <input className="form-input" placeholder="Ej. Primer plato" value={c.label}
                          onChange={e => updateCourse(mi, ci, { label: e.target.value })} style={{ flex: 1 }} />
                        <select className="form-input" value={c.mode ?? 'fixed'}
                          onChange={e => updateCourse(mi, ci, { mode: e.target.value as MenuCourse['mode'] })}
                          style={{ width: 160, flexShrink: 0 }}>
                          {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {c.mode === 'pick_n' && (
                          <input className="form-input" type="number" min={1} placeholder="N" value={c.pick_count ?? 1}
                            onChange={e => updateCourse(mi, ci, { pick_count: parseInt(e.target.value) || 1 })}
                            style={{ width: 60, flexShrink: 0 }} />
                        )}
                        <button type="button" style={removeBtn} onClick={() => removeCourse(mi, ci)} title="Eliminar curso"><X size={13} /></button>
                      </div>

                      {c.items.map((it, ii) => (
                        <div key={ii} style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 18 }}>
                          <input className="form-input" placeholder="Nombre del plato" value={it.name}
                            onChange={e => updateItem(mi, ci, ii, { name: e.target.value })} style={{ flex: 2 }} />
                          <input className="form-input" placeholder="Descripción (opc.)" value={it.description ?? ''}
                            onChange={e => updateItem(mi, ci, ii, { description: e.target.value })} style={{ flex: 3 }} />
                          <input className="form-input" placeholder="+precio" value={it.extra_price ?? ''}
                            onChange={e => updateItem(mi, ci, ii, { extra_price: e.target.value })} style={{ width: 80, flexShrink: 0 }} />
                          <button type="button" style={{ ...removeBtn, width: 24, height: 24 }} onClick={() => removeItem(mi, ci, ii)}><X size={11} /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addItem(mi, ci)}
                        style={{ fontSize: 11, color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 18, padding: '4px 0' }}>
                        + Añadir plato
                      </button>
                    </div>
                  ))}
                  <button type="button" style={addBtn} onClick={() => addCourse(mi)}>+ Añadir curso</button>
                </div>
              </div>
            ))}

            <button type="button" style={addBtn} onClick={addMenu}>+ Añadir menú</button>
          </div>
        )}
      </div>

      {/* ─── EXTRAS ─────────────────────────────────────────────────────────── */}
      <div style={sectionBlock}>
        <div style={sectionHeader} onClick={() => toggle('extras')}>
          <span style={sectionTitle}>Extras opcionales ({extras.length})</span>
          <ChevronDown size={14} style={{ transform: openSections.has('extras') ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--warm-gray)' }} />
        </div>

        {openSections.has('extras') && (
          <div>
            <div style={hint}>
              Estaciones adicionales, resopón, ceremonia, música, proyector… Lo que los invitados pueden añadir.
            </div>

            {extras.map((e, i) => (
              <div key={i} style={itemCard}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select className="form-input" value={e.category}
                    onChange={ev => updateExtra(i, { category: ev.target.value as MenuExtra['category'] })}
                    style={{ width: 180, flexShrink: 0 }}>
                    {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input className="form-input" placeholder="Nombre (ej. Carro de helados)" value={e.name}
                    onChange={ev => updateExtra(i, { name: ev.target.value })} style={{ flex: 1 }} />
                  <button type="button" style={removeBtn} onClick={() => removeExtra(i)}><X size={13} /></button>
                </div>
                <input className="form-input" placeholder="Descripción breve (opcional)" value={e.description ?? ''}
                  onChange={ev => updateExtra(i, { description: ev.target.value })} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="form-input" placeholder="Precio (ej. 45€)" value={e.price}
                    onChange={ev => updateExtra(i, { price: ev.target.value })} style={{ flex: 1 }} />
                  <select className="form-input" value={e.price_type}
                    onChange={ev => updateExtra(i, { price_type: ev.target.value as MenuExtra['price_type'] })}
                    style={{ width: 160, flexShrink: 0 }}>
                    <option value="per_person">Por persona</option>
                    <option value="flat">Precio total</option>
                  </select>
                </div>
              </div>
            ))}

            <button type="button" style={addBtn} onClick={addExtra}>+ Añadir extra</button>
          </div>
        )}
      </div>

      {/* ─── APERITIVOS BASE ────────────────────────────────────────────────── */}
      <div style={sectionBlock}>
        <div style={sectionHeader} onClick={() => toggle('appetizers')}>
          <span style={sectionTitle}>Aperitivos incluidos ({appetizers.length})</span>
          <ChevronDown size={14} style={{ transform: openSections.has('appetizers') ? 'rotate(180deg)' : 'none', transition: 'transform .2s', color: 'var(--warm-gray)' }} />
        </div>

        {openSections.has('appetizers') && (
          <div>
            <div style={hint}>
              Aperitivos que acompañan siempre al menú (fríos, calientes, buffets…). Se muestran como información, sin opción de elegir.
            </div>

            {appetizers.map((g, i) => (
              <div key={i} style={itemCard}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input className="form-input" placeholder="Etiqueta (ej. Aperitivos fríos)" value={g.label}
                    onChange={e => updateGroup(i, { label: e.target.value })} style={{ flex: 1 }} />
                  <button type="button" style={removeBtn} onClick={() => removeGroup(i)}><X size={13} /></button>
                </div>
                <textarea className="form-textarea" style={{ minHeight: 80, fontFamily: 'inherit' }}
                  placeholder="Un item por línea&#10;Crema de melón · Crema de ceps&#10;Airbag con jamón ibérico"
                  defaultValue={g.items.join('\n')}
                  onBlur={e => setGroupItemsText(i, e.target.value)} />
              </div>
            ))}

            <button type="button" style={addBtn} onClick={addGroup}>+ Añadir grupo de aperitivos</button>
          </div>
        )}
      </div>
    </div>
  )
}
