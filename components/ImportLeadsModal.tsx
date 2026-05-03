'use client'
import { useState, useRef, useCallback } from 'react'
import { X, Download, Upload, CheckCircle2, AlertTriangle, XCircle, FileSpreadsheet, Loader2 } from 'lucide-react'
// xlsx imported dynamically to avoid SSR issues
import { createClient } from '@/lib/supabase'

// ── Status mapping ──────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, string> = {
  'nuevo':              'new',
  'new':                'new',
  'contactado':         'contacted',
  'contacted':          'contacted',
  'propuesta enviada':  'proposal_sent',
  'proposal_sent':      'proposal_sent',
  'visita agendada':    'visit_scheduled',
  'visit_scheduled':    'visit_scheduled',
  'post-visita':        'post_visit',
  'post_visit':         'post_visit',
  'presupuesto':        'budget_sent',
  'budget_sent':        'budget_sent',
  'confirmado':         'won',
  'reservado':          'won',
  'won':                'won',
  'perdido':            'lost',
  'lost':               'lost',
}

const CEREMONY_MAP: Record<string, string> = {
  'civil':      'civil',
  'religiosa':  'religiosa',
  'simbólica':  'simbolica',
  'simbolica':  'simbolica',
  'mixta':      'mixta',
  'sin definir':'sin_definir',
}

const BUDGET_MAP: Record<string, string> = {
  'sin definir':         'sin_definir',
  '< 5.000 €':          'menos_5k',
  'menos de 5.000':      'menos_5k',
  '5.000–10.000 €':     '5k_10k',
  '5.000-10.000':        '5k_10k',
  '10.000–20.000 €':    '10k_20k',
  '10.000-20.000':       '10k_20k',
  '20.000–40.000 €':    '20k_40k',
  '20.000-40.000':       '20k_40k',
  '> 40.000 €':          'mas_40k',
  'más de 40.000':       'mas_40k',
}

// ── Column mapping (Excel header → DB field) ────────────────────────────────
const COL_MAP: Record<string, string> = {
  'nombre':         'name',
  'nombre pareja':  'name',
  'email':          'email',
  'teléfono':       'phone',
  'telefono':       'phone',
  'whatsapp':       'whatsapp',
  'país':           'country',
  'pais':           'country',
  'fecha boda':     'wedding_date',
  'invitados':      'guests',
  'adultos':        'guests_adults',
  'niños':          'guests_children',
  'ninos':          'guests_children',
  'estado':         'status',
  'ceremonia':      'ceremony_type',
  'idioma':         'language',
  'presupuesto':    'budget',
  'fecha visita':   'visit_date',
  'hora visita':    'visit_time',
  'notas':          'notes',
}

// ── Date parsing ────────────────────────────────────────────────────────────
function parseDate(raw: any): string | null {
  if (!raw) return null
  // Excel serial number
  if (typeof raw === 'number') {
    const d = new Date((raw - 25569) * 86400 * 1000)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
    return null
  }
  const s = String(raw).trim()
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY or DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/)
  if (m) {
    const [, dd, mm, yyyy] = m
    const d = new Date(+yyyy, +mm - 1, +dd)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }
  // Try native parse
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

// ── Types ───────────────────────────────────────────────────────────────────
type ParsedRow = {
  rowNum: number
  data: Record<string, any>
  status: 'ok' | 'warning' | 'error'
  message: string
  dbStatus: string
  duplicate?: boolean
  existingLeadId?: string
}

type Props = {
  open: boolean
  onClose: () => void
  userId: string
  venueId: string
  existingEmails: Set<string>
  onImported: () => void
}

// ── Template download ───────────────────────────────────────────────────────
async function downloadTemplate() {
  const XLSX = await import('xlsx')
  const headers = [
    'Nombre pareja', 'Email', 'Teléfono', 'WhatsApp', 'País',
    'Fecha boda', 'Invitados', 'Adultos', 'Niños',
    'Estado', 'Ceremonia', 'Idioma', 'Presupuesto',
    'Fecha visita', 'Hora visita', 'Notas',
  ]

  const example = [
    'María y Carlos', 'maria@email.com', '+34612345678', '+34612345678', 'España',
    '15/06/2027', '150', '120', '30',
    'Nuevo', 'Civil', 'Español', '20.000–40.000 €',
    '', '', 'Quieren ceremonia en el jardín',
  ]

  const wb = XLSX.utils.book_new()

  // Sheet 1: Plantilla
  const ws = XLSX.utils.aoa_to_sheet([headers, example])

  // Column widths
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }))

  // Data validation (dropdowns) for Estado (col J=9), Ceremonia (col K=10), Presupuesto (col M=12)
  // SheetJS community edition doesn't support data validation natively,
  // so we add them as comments/notes + instruction sheet explains values
  ws['!dataValidations'] = ws['!dataValidations'] || []

  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla')

  // Sheet 2: Instrucciones
  const instrucciones = [
    ['Columna', 'Descripción', 'Valores válidos', 'Obligatorio'],
    ['Nombre pareja', 'Nombre de la pareja', 'Texto libre', 'Sí'],
    ['Email', 'Correo electrónico de contacto', 'email@ejemplo.com', 'No'],
    ['Teléfono', 'Número de teléfono', '+34612345678', 'No'],
    ['WhatsApp', 'Número de WhatsApp (si diferente)', '+34612345678', 'No'],
    ['País', 'País de origen de la pareja', 'Texto libre (ej: España, UK, USA)', 'No'],
    ['Fecha boda', 'Fecha de la boda', 'DD/MM/YYYY o YYYY-MM-DD', 'No'],
    ['Invitados', 'Número total de invitados', 'Número (ej: 150)', 'No'],
    ['Adultos', 'Número de adultos', 'Número (ej: 120)', 'No'],
    ['Niños', 'Número de niños', 'Número (ej: 30)', 'No'],
    ['Estado', 'Estado actual del lead', '', 'No (default: Nuevo)'],
    ['', '', 'Nuevo — Lead recién recibido', ''],
    ['', '', 'Contactado — Ya se ha contactado a la pareja', ''],
    ['', '', 'Propuesta enviada — Se le envió propuesta/dosier', ''],
    ['', '', 'Visita agendada — Tiene visita programada', ''],
    ['', '', 'Post-visita — Ya realizó la visita', ''],
    ['', '', 'Presupuesto — Se le envió presupuesto', ''],
    ['', '', 'Confirmado — Boda confirmada/reservada', ''],
    ['', '', 'Perdido — Lead descartado', ''],
    ['Ceremonia', 'Tipo de ceremonia', 'Civil, Religiosa, Simbólica, Mixta, Sin definir', 'No'],
    ['Idioma', 'Idioma principal de la pareja', 'Texto libre (ej: Español, English)', 'No'],
    ['Presupuesto', 'Rango de presupuesto estimado', '', 'No'],
    ['', '', 'Sin definir', ''],
    ['', '', '< 5.000 €', ''],
    ['', '', '5.000–10.000 €', ''],
    ['', '', '10.000–20.000 €', ''],
    ['', '', '20.000–40.000 €', ''],
    ['', '', '> 40.000 €', ''],
    ['Fecha visita', 'Fecha de visita al venue (si aplica)', 'DD/MM/YYYY o YYYY-MM-DD', 'No'],
    ['Hora visita', 'Hora de la visita', 'HH:MM (ej: 11:00)', 'No'],
    ['Notas', 'Notas internas sobre el lead', 'Texto libre', 'No'],
  ]

  const ws2 = XLSX.utils.aoa_to_sheet(instrucciones)
  ws2['!cols'] = [{ wch: 18 }, { wch: 40 }, { wch: 50 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Instrucciones')

  XLSX.writeFile(wb, 'plantilla-leads-wvs.xlsx')
}

// ── Component ───────────────────────────────────────────────────────────────
export default function ImportLeadsModal({ open, onClose, userId, venueId, existingEmails, onImported }: Props) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; updated: number; skipped: number; calendarCreated: number }>({ created: 0, updated: 0, skipped: 0, calendarCreated: 0 })
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => { setStep('upload'); setRows([]); setImporting(false); setImportResult({ created: 0, updated: 0, skipped: 0, calendarCreated: 0 }) }

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

        // Map headers
        const headerRow = raw[0].map((h: any) => String(h || '').trim().toLowerCase())
        const colIdx: Record<string, number> = {}
        headerRow.forEach((h, i) => {
          const mapped = COL_MAP[h]
          if (mapped) colIdx[mapped] = i
        })

        const parsed: ParsedRow[] = []
        for (let r = 1; r < raw.length; r++) {
          const cells = raw[r]
          if (!cells || cells.every((c: any) => !c)) continue // skip empty rows

          const get = (field: string) => colIdx[field] !== undefined ? cells[colIdx[field]] : undefined
          const name = String(get('name') || '').trim()
          const email = String(get('email') || '').trim().toLowerCase()

          if (!name) {
            parsed.push({ rowNum: r + 1, data: {}, status: 'error', message: 'Sin nombre — se ignorará', dbStatus: 'new' })
            continue
          }

          const weddingDate = parseDate(get('wedding_date'))
          const visitDate = parseDate(get('visit_date'))
          const rawStatus = String(get('status') || '').trim().toLowerCase()
          const dbStatus = STATUS_MAP[rawStatus] || 'new'
          const rawCeremony = String(get('ceremony_type') || '').trim().toLowerCase()
          const dbCeremony = CEREMONY_MAP[rawCeremony] || (rawCeremony || undefined)
          const rawBudget = String(get('budget') || '').trim().toLowerCase()
          const dbBudget = BUDGET_MAP[rawBudget] || Object.values(BUDGET_MAP).includes(rawBudget) ? rawBudget : undefined

          const guests = get('guests') ? parseInt(String(get('guests')), 10) : undefined
          const guestsAdults = get('guests_adults') ? parseInt(String(get('guests_adults')), 10) : undefined
          const guestsChildren = get('guests_children') ? parseInt(String(get('guests_children')), 10) : undefined

          const isDuplicate = !!email && existingEmails.has(email)

          const rowData: Record<string, any> = {
            name,
            email: email || undefined,
            phone: get('phone') ? String(get('phone')).trim() : undefined,
            whatsapp: get('whatsapp') ? String(get('whatsapp')).trim() : undefined,
            country: get('country') ? String(get('country')).trim() : undefined,
            wedding_date: weddingDate || undefined,
            guests: isNaN(guests!) ? undefined : guests,
            guests_adults: isNaN(guestsAdults!) ? undefined : guestsAdults,
            guests_children: isNaN(guestsChildren!) ? undefined : guestsChildren,
            status: dbStatus,
            ceremony_type: dbCeremony,
            language: get('language') ? String(get('language')).trim() : undefined,
            budget: dbBudget,
            visit_date: visitDate || undefined,
            visit_time: get('visit_time') ? String(get('visit_time')).trim() : undefined,
            notes: get('notes') ? String(get('notes')).trim() : undefined,
          }

          // Clean undefined
          Object.keys(rowData).forEach(k => { if (rowData[k] === undefined) delete rowData[k] })

          const calendarNote = dbStatus === 'won' && weddingDate ? ' → creará reserva en calendario' :
            (dbStatus === 'proposal_sent' || dbStatus === 'budget_sent') && weddingDate ? ' → creará negociación en calendario' : ''

          parsed.push({
            rowNum: r + 1,
            data: rowData,
            status: isDuplicate ? 'warning' : 'ok',
            message: isDuplicate
              ? `Email "${email}" ya existe` + calendarNote
              : (name + calendarNote),
            dbStatus,
            duplicate: isDuplicate,
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
  }, [existingEmails])

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
    let created = 0, updated = 0, skipped = 0, calendarCreated = 0

    for (const row of rows) {
      if (row.status === 'error') { skipped++; continue }
      if (row.duplicate && duplicateAction === 'skip') { skipped++; continue }

      const payload: any = {
        ...row.data,
        user_id: userId,
        venue_id: venueId,
      }

      // Remove status from payload for insert — we set it separately
      const status = payload.status || 'new'
      delete payload.status

      let leadId: string | null = null

      if (row.duplicate && duplicateAction === 'update') {
        // Find and update existing lead
        const { data: existing } = await supabase
          .from('leads')
          .select('id')
          .eq('venue_id', venueId)
          .eq('email', row.data.email)
          .single()

        if (existing) {
          const { error } = await supabase
            .from('leads')
            .update({ ...payload, status })
            .eq('id', existing.id)
          if (!error) { updated++; leadId = existing.id }
          else { skipped++; continue }
        }
      } else {
        // Insert new lead
        const insertPayload = {
          ...payload,
          status,
          original_date_flexibility: 'exact',
          original_wedding_date: payload.wedding_date || null,
        }
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert(insertPayload)
          .select('id')
          .single()
        if (!error && newLead) { created++; leadId = newLead.id }
        else { skipped++; continue }
      }

      // Calendar auto-sync
      if (leadId && row.data.wedding_date) {
        const calStatus: string | null =
          status === 'won' ? 'reservado' :
          (status === 'proposal_sent' || status === 'budget_sent' || status === 'visit_scheduled') ? 'negociacion' :
          null

        if (calStatus) {
          const { error: calErr } = await supabase
            .from('calendar_entries')
            .upsert({
              date: row.data.wedding_date,
              status: calStatus,
              lead_id: leadId,
              user_id: userId,
              venue_id: venueId,
            }, { onConflict: 'user_id,date' })
          if (!calErr) calendarCreated++
        }
      }
    }

    setImportResult({ created, updated, skipped, calendarCreated })
    setStep('done')
    setImporting(false)
    onImported()
  }

  if (!open) return null

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
        background: '#fff', borderRadius: 16, width: '90%', maxWidth: 720,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--ivory)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--charcoal)' }}>Importar leads</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--warm-gray)' }}>
              {step === 'upload' && 'Sube un archivo Excel con tus leads'}
              {step === 'preview' && `${rows.length} filas encontradas — revisa antes de importar`}
              {step === 'importing' && 'Importando leads…'}
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

          {/* ── Step: Upload ────────────────────────────────────────────── */}
          {step === 'upload' && (
            <div>
              {/* Download template */}
              <div style={{
                background: '#faf8f5', border: '1px solid var(--ivory)', borderRadius: 12,
                padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <FileSpreadsheet size={28} style={{ color: '#047857', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>
                    1. Descarga la plantilla
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                    Excel con las columnas correctas, valores válidos y una fila de ejemplo.
                    Incluye hoja de instrucciones.
                  </div>
                </div>
                <button className="btn btn-sm" onClick={downloadTemplate}
                  style={{ background: '#047857', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
                  <Download size={13} /> Descargar plantilla
                </button>
              </div>

              {/* Upload area */}
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
                  2. Sube tu archivo con los leads
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>
                  Arrastra aquí o haz click para seleccionar · Excel (.xlsx) o CSV
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange}
                  style={{ display: 'none' }} />
              </div>
            </div>
          )}

          {/* ── Step: Preview ───────────────────────────────────────────── */}
          {step === 'preview' && (
            <div>
              {/* Summary badges */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#d1fae5', color: '#065f46' }}>
                  <CheckCircle2 size={12} /> {okRows.length} listos
                </span>
                {warnRows.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#fef7ec', color: '#8a6d2b' }}>
                    <AlertTriangle size={12} /> {warnRows.length} duplicados
                  </span>
                )}
                {errRows.length > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#fee2e2', color: '#991b1b' }}>
                    <XCircle size={12} /> {errRows.length} con errores
                  </span>
                )}
              </div>

              {/* Duplicate action */}
              {warnRows.length > 0 && (
                <div style={{
                  background: '#fef7ec', border: '1px solid #f5deb3', borderRadius: 10,
                  padding: '12px 16px', marginBottom: 16, fontSize: 13,
                }}>
                  <div style={{ fontWeight: 600, color: '#8a6d2b', marginBottom: 8 }}>
                    ¿Qué hacer con los {warnRows.length} leads duplicados?
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, cursor: 'pointer' }}>
                    <input type="radio" checked={duplicateAction === 'skip'} onChange={() => setDuplicateAction('skip')} />
                    <span>Saltar — no importar duplicados</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" checked={duplicateAction === 'update'} onChange={() => setDuplicateAction('update')} />
                    <span>Actualizar — sobreescribir datos del lead existente</span>
                  </label>
                </div>
              )}

              {/* Row list */}
              <div style={{ border: '1px solid var(--ivory)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: '40px 1fr 140px 100px',
                  padding: '8px 12px', background: '#faf8f5', fontSize: 11, fontWeight: 600,
                  color: 'var(--warm-gray)', borderBottom: '1px solid var(--ivory)',
                }}>
                  <span>Fila</span><span>Nombre</span><span>Estado</span><span>Resultado</span>
                </div>
                <div style={{ maxHeight: 320, overflow: 'auto' }}>
                  {rows.map((row, i) => {
                    const willSkip = row.status === 'error' || (row.duplicate && duplicateAction === 'skip')
                    return (
                      <div key={i} style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr 140px 100px',
                        padding: '8px 12px', fontSize: 12, borderBottom: '1px solid #f5f0eb',
                        opacity: willSkip ? 0.5 : 1,
                        background: row.status === 'error' ? '#fff5f5' : row.duplicate ? '#fffbeb' : '#fff',
                      }}>
                        <span style={{ color: 'var(--warm-gray)' }}>{row.rowNum}</span>
                        <span style={{ color: 'var(--charcoal)', fontWeight: 500 }}>
                          {row.data.name || '—'}
                          {row.data.email && <span style={{ fontWeight: 400, color: 'var(--warm-gray)', marginLeft: 6 }}>{row.data.email}</span>}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                          {row.dbStatus === 'won' ? 'Confirmado' : row.dbStatus === 'new' ? 'Nuevo' : row.dbStatus}
                        </span>
                        <span>
                          {row.status === 'ok' && <span style={{ color: '#047857', display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle2 size={11} /> Importar</span>}
                          {row.status === 'warning' && <span style={{ color: '#8a6d2b', display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {duplicateAction === 'skip' ? 'Saltar' : 'Actualizar'}</span>}
                          {row.status === 'error' && <span style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: 3 }}><XCircle size={11} /> Error</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Importing ─────────────────────────────────────────── */}
          {step === 'importing' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader2 size={32} style={{ color: 'var(--espresso)', animation: 'spin 1s linear infinite', marginBottom: 16 }} />
              <div style={{ fontSize: 14, color: 'var(--charcoal)' }}>Importando leads…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {/* ── Step: Done ──────────────────────────────────────────────── */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '30px 0' }}>
              <CheckCircle2 size={40} style={{ color: '#047857', marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 16 }}>
                Importación completada
              </div>
              <div style={{
                display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '6px 20px',
                textAlign: 'left', fontSize: 13, color: 'var(--charcoal)',
              }}>
                <span>Leads creados:</span><strong>{importResult.created}</strong>
                {importResult.updated > 0 && <><span>Leads actualizados:</span><strong>{importResult.updated}</strong></>}
                {importResult.skipped > 0 && <><span>Filas saltadas:</span><strong>{importResult.skipped}</strong></>}
                {importResult.calendarCreated > 0 && <><span>Fechas en calendario:</span><strong>{importResult.calendarCreated}</strong></>}
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
              <button className="btn btn-ghost btn-sm" onClick={() => { reset() }}>
                Volver
              </button>
              <button className="btn btn-sm" onClick={doImport} disabled={importableCount === 0}
                style={{ background: 'var(--espresso)', color: '#fff', border: 'none' }}>
                Importar {importableCount} lead{importableCount !== 1 ? 's' : ''}
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
