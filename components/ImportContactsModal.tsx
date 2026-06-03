'use client'
import { useState, useRef, useCallback } from 'react'
import { X, Download, Upload, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { ClientType } from '@/lib/clients'

// ── Type mapping ────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, ClientType> = {
  'pareja':           'pareja',
  'couple':           'pareja',
  'wedding planner':  'wedding_planner',
  'wp':               'wedding_planner',
  'planner':          'wedding_planner',
  'organizador':      'organizador',
  'organizer':        'organizador',
  'empresa':          'empresa',
  'company':          'empresa',
  'cliente':          'cliente',
  'client':           'cliente',
  'otro':             'otro',
  'other':            'otro',
}

// ── Column mapping ──────────────────────────────────────────────────────────
const COL_MAP: Record<string, string> = {
  'nombre':         'name',
  'nombre contacto':'name',
  'name':           'name',
  'email':          'email',
  'correo':         'email',
  'teléfono':       'phone',
  'telefono':       'phone',
  'phone':          'phone',
  'whatsapp':       'whatsapp',
  'tipo':           'client_type',
  'type':           'client_type',
  'país':           'country',
  'pais':           'country',
  'country':        'country',
  'idioma':         'language',
  'language':       'language',
  'etiquetas':      'tags',
  'tags':           'tags',
  'notas':          'notes',
  'notes':          'notes',
}

function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '')
}

// ── Types ───────────────────────────────────────────────────────────────────
type ParsedRow = {
  rowNum: number
  data: Record<string, any>
  status: 'ok' | 'warning' | 'error'
  message: string
  duplicate?: boolean
  matchType?: 'email' | 'phone'
}

type Props = {
  open: boolean
  onClose: () => void
  venueId: string
  existingEmails: Set<string>
  existingPhones: Set<string>
  onImported: () => void
}

// ── Template download ───────────────────────────────────────────────────────
async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const headers = [
    'Nombre', 'Email', 'Teléfono', 'WhatsApp', 'Tipo',
    'País', 'Idioma', 'Etiquetas', 'Notas',
  ]

  const examples = [
    ['Ana y Pedro', 'ana@email.com', '+34612345678', '', 'Pareja', 'España', 'Español', '', 'Conocidos en feria nupcial'],
    ['Laura Events', 'laura@events.com', '+34698765432', '+34698765432', 'Wedding Planner', 'España', 'Español', 'preferente, Barcelona', 'Colaboración desde 2024'],
    ['Catering Deluxe', 'info@cateringdeluxe.es', '+34911223344', '', 'Empresa', 'España', 'Español', 'catering', ''],
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
  XLSX.utils.book_append_sheet(wb, ws, 'Contactos')

  // Instructions sheet
  const instrucciones = [
    ['Columna', 'Descripción', 'Valores válidos', 'Obligatorio'],
    ['Nombre', 'Nombre del contacto', 'Texto libre', 'Sí'],
    ['Email', 'Correo electrónico', 'email@ejemplo.com', 'No (recomendado)'],
    ['Teléfono', 'Número de teléfono', '+34612345678', 'No (recomendado)'],
    ['WhatsApp', 'Número de WhatsApp (si diferente)', '+34612345678', 'No'],
    ['Tipo', 'Tipo de contacto', '', 'No (default: Pareja)'],
    ['', '', 'Pareja', ''],
    ['', '', 'Wedding Planner', ''],
    ['', '', 'Organizador', ''],
    ['', '', 'Empresa', ''],
    ['', '', 'Cliente', ''],
    ['', '', 'Otro', ''],
    ['País', 'País del contacto', 'Texto libre (ej: España, UK)', 'No'],
    ['Idioma', 'Idioma principal', 'Texto libre (ej: Español, English)', 'No'],
    ['Etiquetas', 'Etiquetas separadas por coma', 'ej: vip, barcelona, 2025', 'No'],
    ['Notas', 'Notas internas', 'Texto libre', 'No'],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(instrucciones)
  ws2['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 40 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')

  XLSX.writeFile(wb, 'plantilla-contactos-wvs.xlsx')
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ImportContactsModal({ open, onClose, venueId, existingEmails, existingPhones, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number }>({ created: 0, updated: 0, skipped: 0 })
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => { setStep('upload'); setRows([]); setImporting(false); setImportResult({ created: 0, updated: 0, skipped: 0 }) }

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

        if (raw.length < 2) { alert('El archivo está vacío o solo tiene cabecera.'); return }

        const headerRow = raw[0].map((h: any) => String(h || '').trim().toLowerCase())
        const colIdx: Record<string, number> = {}
        headerRow.forEach((h, i) => {
          const mapped = COL_MAP[h]
          if (mapped) colIdx[mapped] = i
        })

        const parsed: ParsedRow[] = []
        for (let r = 1; r < raw.length; r++) {
          const cells = raw[r]
          if (!cells || cells.every((c: any) => !c)) continue

          const get = (field: string) => colIdx[field] !== undefined ? cells[colIdx[field]] : undefined
          const name = String(get('name') || '').trim()
          const email = String(get('email') || '').trim().toLowerCase()
          const phone = get('phone') ? normalizePhone(String(get('phone')).trim()) : ''

          if (!name) {
            parsed.push({ rowNum: r + 1, data: {}, status: 'error', message: 'Sin nombre — se ignorará' })
            continue
          }

          const rawType = String(get('client_type') || '').trim().toLowerCase()
          const clientType = TYPE_MAP[rawType] || 'pareja'
          const rawTags = String(get('tags') || '').trim()
          const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : []

          // Duplicate detection
          const emailDup = !!email && existingEmails.has(email)
          const phoneDup = !!phone && existingPhones.has(phone)
          const isDuplicate = emailDup || phoneDup
          const matchType = emailDup ? 'email' as const : phoneDup ? 'phone' as const : undefined

          const rowData: Record<string, any> = {
            name,
            email: email || null,
            phone: phone || null,
            whatsapp: get('whatsapp') ? normalizePhone(String(get('whatsapp')).trim()) : null,
            client_type: clientType,
            country: get('country') ? String(get('country')).trim() : null,
            language: get('language') ? String(get('language')).trim() : null,
            tags,
            notes: get('notes') ? String(get('notes')).trim() : '',
          }

          const dupMsg = matchType === 'phone'
            ? `Teléfono "${phone}" ya existe`
            : `Email "${email}" ya existe`

          parsed.push({
            rowNum: r + 1,
            data: rowData,
            status: isDuplicate ? 'warning' : 'ok',
            message: isDuplicate ? dupMsg : name,
            duplicate: isDuplicate,
            matchType,
          })
        }

        setRows(parsed)
        setStep('preview')
      } catch (err) {
        console.error('Parse error:', err)
        alert('Error al leer el archivo. Asegúrate de que es un archivo Excel (.xlsx) o CSV válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [existingEmails, existingPhones])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }, [parseFile])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  // ── Import ──────────────────────────────────────────────────────────────────
  const doImport = async () => {
    setImporting(true)
    setStep('importing')
    const supabase = createClient()
    let created = 0, updated = 0, skipped = 0

    for (const row of rows) {
      if (row.status === 'error') { skipped++; continue }
      if (row.duplicate && duplicateAction === 'skip') { skipped++; continue }

      if (row.duplicate && duplicateAction === 'update') {
        // Find existing by email or phone and enrich
        let existing: any = null
        if (row.matchType === 'email' && row.data.email) {
          const { data } = await supabase
            .from('clients').select('id, email, phone, whatsapp, language, country, notes, tags')
            .eq('venue_id', venueId).eq('email', row.data.email).limit(1).single()
          existing = data
        } else if (row.matchType === 'phone' && row.data.phone) {
          const { data } = await supabase
            .from('clients').select('id, email, phone, whatsapp, language, country, notes, tags')
            .eq('venue_id', venueId).eq('phone', row.data.phone).limit(1).single()
          existing = data
        }

        if (existing) {
          // Enrich: fill missing fields, merge tags, append notes
          const updates: Record<string, any> = {}
          if (!existing.email && row.data.email) updates.email = row.data.email
          if (!existing.phone && row.data.phone) updates.phone = row.data.phone
          if (!existing.whatsapp && row.data.whatsapp) updates.whatsapp = row.data.whatsapp
          if (!existing.language && row.data.language) updates.language = row.data.language
          if (!existing.country && row.data.country) updates.country = row.data.country
          // Merge tags
          if (row.data.tags.length > 0) {
            const existingTags = Array.isArray(existing.tags) ? existing.tags : []
            const merged = [...new Set([...existingTags, ...row.data.tags])]
            if (merged.length > existingTags.length) updates.tags = merged
          }
          // Append notes
          if (row.data.notes && row.data.notes !== existing.notes) {
            updates.notes = existing.notes
              ? `${existing.notes}\n---\n${row.data.notes}`
              : row.data.notes
          }
          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('clients').update(updates).eq('id', existing.id)
            if (!error) updated++
            else skipped++
          } else {
            skipped++ // nothing to update
          }
        } else {
          skipped++
        }
      } else {
        // Insert new client
        const { error } = await supabase.from('clients').insert({
          venue_id: venueId,
          name: row.data.name,
          email: row.data.email,
          phone: row.data.phone,
          whatsapp: row.data.whatsapp,
          client_type: row.data.client_type,
          country: row.data.country,
          language: row.data.language,
          tags: row.data.tags,
          notes: row.data.notes,
        })
        if (!error) created++
        else { console.error('Insert client error:', error); skipped++ }
      }
    }

    setImportResult({ created, updated, skipped })
    setStep('done')
    setImporting(false)
    onImported()
  }

  if (!open) return null

  const TYPE_LABEL: Record<string, string> = {
    pareja: 'Pareja', wedding_planner: 'WP', organizador: 'Org.', empresa: 'Empresa', cliente: 'Cliente', otro: 'Otro',
  }

  const okRows = rows.filter(r => r.status === 'ok')
  const warnRows = rows.filter(r => r.status === 'warning')
  const errRows = rows.filter(r => r.status === 'error')
  const importableCount = okRows.length + (duplicateAction === 'update' ? warnRows.length : 0)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => { if (e.target === e.currentTarget) { reset(); onClose() } }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '90%', maxWidth: 700,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--ivory)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--charcoal)' }}>Importar contactos</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--warm-gray)' }}>
              {step === 'upload' && 'Sube un Excel con tu lista de contactos'}
              {step === 'preview' && `${rows.length} contactos encontrados — revisa antes de importar`}
              {step === 'importing' && 'Importando contactos…'}
              {step === 'done' && 'Importación completada'}
            </p>
          </div>
          <button onClick={() => { reset(); onClose() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

          {step === 'upload' && (
            <div>
              <div style={{
                background: '#faf8f5', border: '1px solid var(--ivory)', borderRadius: 12,
                padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <FileSpreadsheet size={28} style={{ color: '#3C5945', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>
                    1. Descarga la plantilla
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                    Excel con columnas para parejas, wedding planners, empresas y otros contactos.
                  </div>
                </div>
                <button className="btn btn-sm" onClick={downloadTemplate}
                  style={{ background: '#3C5945', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
                  <Download size={13} /> Descargar plantilla
                </button>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? 'var(--espresso)' : 'var(--ivory)'}`,
                  borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? '#faf8f5' : '#fff',
                  transition: 'all 0.15s ease',
                }}
              >
                <Upload size={32} style={{ color: 'var(--warm-gray)', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }}>
                  2. Sube tu archivo con los contactos
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                  Arrastra aquí o haz click para seleccionar · Excel (.xlsx) o CSV
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange}
                  style={{ display: 'none' }} />
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#DCE7DE', color: '#35513E' }}>
                  <CheckCircle2 size={12} /> {okRows.length} nuevos
                </span>
                {warnRows.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#fef7ec', color: '#8a6d2b' }}>
                    <AlertTriangle size={12} /> {warnRows.length} duplicados
                  </span>
                )}
                {errRows.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#F2E2E0', color: '#7E332D' }}>
                    <XCircle size={12} /> {errRows.length} errores
                  </span>
                )}
              </div>

              {warnRows.length > 0 && (
                <div style={{
                  background: '#fef7ec', border: '1px solid #f5deb3', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16, fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, color: '#8a6d2b', marginBottom: 8 }}>
                    {warnRows.length} contacto{warnRows.length !== 1 ? 's' : ''} ya existe{warnRows.length !== 1 ? 'n' : ''}
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                    <input type="radio" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} />
                    <span>Saltar — no modificar existentes</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={duplicateAction === 'update'} onChange={() => setDuplicateAction('update')} />
                    <span>Enriquecer — rellenar campos vacíos y fusionar etiquetas</span>
                  </label>
                </div>
              )}

              <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 80px 90px',
                  padding: '8px 12px', background: '#faf8f5', fontSize: 11, fontWeight: 600,
                  color: 'var(--warm-gray)', borderBottom: '1px solid var(--ivory)',
                }}>
                  <span>#</span><span>Contacto</span><span>Tipo</span><span>Acción</span>
                </div>
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  {rows.map((row, i) => {
                    const willSkip = row.status === 'error' || (row.duplicate && duplicateAction === 'skip')
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '36px 1fr 80px 90px',
                        padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f5f0eb',
                        opacity: willSkip ? 0.45 : 1,
                        background: row.status === 'error' ? '#FAF4F3' : row.duplicate ? '#FFFCF5' : '#fff',
                      }}>
                        <span style={{ color: 'var(--warm-gray)', fontSize: 11 }}>{row.rowNum}</span>
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ color: 'var(--charcoal)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.data.name || '—'}
                          </div>
                          {(row.data.email || row.data.phone) && (
                            <div style={{ fontSize: 10.5, color: 'var(--warm-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {[row.data.email, row.data.phone].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          {row.duplicate && (
                            <div style={{ fontSize: 10, color: '#8a6d2b', marginTop: 1 }}>
                              {row.matchType === 'phone' ? 'Teléfono' : 'Email'} coincide con contacto existente
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          {TYPE_LABEL[row.data.client_type] || row.data.client_type || '—'}
                        </span>
                        <span>
                          {row.status === 'ok' && <span style={{ color: '#3C5945', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><CheckCircle2 size={11} /> Crear</span>}
                          {row.status === 'warning' && <span style={{ color: '#8a6d2b', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><AlertTriangle size={11} /> {duplicateAction === 'skip' ? 'Saltar' : 'Enriquecer'}</span>}
                          {row.status === 'error' && <span style={{ color: '#7E332D', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}><XCircle size={11} /> Error</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--espresso)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: 'var(--charcoal)' }}>Importando contactos…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <CheckCircle2 size={40} style={{ color: '#3C5945', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 16 }}>
                Importación completada
              </div>
              <div style={{
                display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '6px 20px',
                textAlign: 'left', fontSize: 13, color: 'var(--charcoal)',
              }}>
                <span>Contactos creados:</span><strong>{importResult.created}</strong>
                {importResult.updated > 0 && <><span>Contactos enriquecidos:</span><strong>{importResult.updated}</strong></>}
                {importResult.skipped > 0 && <><span>Filas saltadas:</span><strong>{importResult.skipped}</strong></>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid var(--ivory)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          {step === 'preview' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => { reset() }}>Volver</button>
              <button className="btn btn-sm" onClick={doImport} disabled={importableCount === 0}
                style={{ background: 'var(--espresso)', color: '#fff', border: 'none' }}>
                Importar {importableCount} contacto{importableCount !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {step === 'done' && (
            <button className="btn btn-sm" onClick={() => { reset(); onClose() }}
              style={{ background: 'var(--espresso)', color: '#fff', border: 'none' }}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
