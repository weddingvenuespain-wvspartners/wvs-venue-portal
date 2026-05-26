'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import { ArrowLeft, Send, CheckCircle, XCircle, Edit3, Trash2, Plus, Save, FileText, Calendar, Users, PenTool, RotateCcw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = { title: string; content: string }

type Contract = {
  id: string
  contract_number: string
  title: string
  client_name: string
  client_email: string | null
  client_nif: string | null
  wedding_date: string | null
  venue_name: string
  total_amount: number
  deposit_amount: number
  template: string
  status: string
  sections: Section[]
  venue_signed_at: string | null
  client_signed_at: string | null
  venue_signature_url: string | null
  client_signature_url: string | null
  sent_at: string | null
  notes: string | null
  budget_id: string | null
  lead_id: string | null
  invoice_id: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; badge: string }> = {
  draft:     { label: 'Borrador',   badge: 'badge-inactive' },
  sent:      { label: 'Enviado',    badge: 'badge-pending' },
  signed:    { label: 'Firmado',    badge: 'badge-active' },
  active:    { label: 'Activo',     badge: 'badge-active' },
  completed: { label: 'Completado', badge: 'badge-contacted' },
  cancelled: { label: 'Cancelado',  badge: 'badge-inactive' },
}

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n))
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContractDetailPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.id as string
  const { user, loading: authLoading } = useAuth()
  const { isBlocked } = useRequireSubscription()

  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Edit state
  const [editTitle, setEditTitle] = useState('')
  const [editSections, setEditSections] = useState<Section[]>([])
  const [editNotes, setEditNotes] = useState('')

  // Signature state
  const [showSignModal, setShowSignModal] = useState<'venue' | 'client' | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  // Lead association state
  const [leads, setLeads] = useState<Array<{ id: string; name: string; email: string | null; wedding_date: string | null }>>([])
  const [showLeadPicker, setShowLeadPicker] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    loadContract()
  }, [user, authLoading, contractId])

  const loadContract = async () => {
    const supabase = createClient()
    const [ctrRes, leadsRes] = await Promise.all([
      supabase.from('venue_contracts').select('*').eq('id', contractId).eq('user_id', user!.id).single(),
      supabase.from('leads').select('id, name, email, wedding_date').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(200),
    ])

    if (ctrRes.data) {
      setContract(ctrRes.data)
      setEditTitle(ctrRes.data.title)
      setEditSections(Array.isArray(ctrRes.data.sections) ? ctrRes.data.sections : [])
      setEditNotes(ctrRes.data.notes || '')
    }
    if (leadsRes.data) setLeads(leadsRes.data)
    setLoading(false)
  }

  // Associate / dissociate lead
  const associateLead = async (leadId: string) => {
    if (!contract) return
    const supabase = createClient()
    await supabase.from('venue_contracts').update({ lead_id: leadId }).eq('id', contract.id)
    setShowLeadPicker(false)
    setLeadSearch('')
    await loadContract()
  }
  const dissociateLead = async () => {
    if (!contract) return
    if (!confirm('¿Desvincular este lead del contrato?')) return
    const supabase = createClient()
    await supabase.from('venue_contracts').update({ lead_id: null }).eq('id', contract.id)
    await loadContract()
  }

  const startEditing = () => {
    if (!contract) return
    setEditTitle(contract.title)
    setEditSections(Array.isArray(contract.sections) ? [...contract.sections] : [])
    setEditNotes(contract.notes || '')
    setEditing(true)
  }

  const handleSave = async () => {
    if (!contract) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('venue_contracts').update({
      title: editTitle,
      sections: editSections,
      notes: editNotes || null,
    }).eq('id', contract.id)

    await loadContract()
    setEditing(false)
    setSaving(false)
  }

  const updateStatus = async (newStatus: string) => {
    if (!contract) return
    setUpdating(true)
    const supabase = createClient()
    const updates: any = { status: newStatus }
    if (newStatus === 'sent') updates.sent_at = new Date().toISOString()
    if (newStatus === 'signed') updates.venue_signed_at = new Date().toISOString()

    await supabase.from('venue_contracts').update(updates).eq('id', contract.id)
    await loadContract()
    setUpdating(false)
  }

  const deleteContract = async () => {
    if (!contract || !confirm('¿Eliminar este contrato? Esta acción no se puede deshacer.')) return
    const supabase = createClient()
    await supabase.from('venue_contracts').delete().eq('id', contract.id)
    router.push('/contratos')
  }

  const updateSection = (idx: number, field: 'title' | 'content', value: string) => {
    setEditSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const addSection = () => {
    setEditSections(prev => [...prev, { title: 'Nueva cláusula', content: '' }])
  }

  const removeSection = (idx: number) => {
    setEditSections(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Signature canvas methods ──
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  useEffect(() => {
    if (showSignModal) {
      setTimeout(initCanvas, 50)
    }
  }, [showSignModal, initCanvas])

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true
    lastPos.current = getCanvasPos(e)
  }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos = getCanvasPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }
  const stopDraw = () => { isDrawing.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    initCanvas()
  }

  const saveSignature = async () => {
    if (!contract || !canvasRef.current || !showSignModal) return
    const dataUrl = canvasRef.current.toDataURL('image/png')
    const supabase = createClient()
    const updates: Record<string, any> = {}
    if (showSignModal === 'venue') {
      updates.venue_signature_url = dataUrl
      updates.venue_signed_at = new Date().toISOString()
    } else {
      updates.client_signature_url = dataUrl
      updates.client_signed_at = new Date().toISOString()
    }
    await supabase.from('venue_contracts').update(updates).eq('id', contract.id)
    await loadContract()
    setShowSignModal(null)
  }

  if (isBlocked) return null
  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)' }}>Cargando contrato...</div>
    </div>
  )

  if (!contract) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div className="page-content" style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 14, color: 'var(--warm-gray)' }}>Contrato no encontrado</div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/contratos')}>
            <ArrowLeft size={13} /> Volver
          </button>
        </div>
      </div>
    </div>
  )

  const st = STATUS_MAP[contract.status] ?? STATUS_MAP.draft
  const sections: Section[] = Array.isArray(contract.sections) ? contract.sections : []

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">

        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => router.push('/contratos')}>
              <ArrowLeft size={14} />
            </button>
            <div className="topbar-title">{contract.contract_number}</div>
            <span className={`badge ${st.badge}`}>{st.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                  <Save size={13} /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            ) : (
              <>
                {['draft', 'sent'].includes(contract.status) && (
                  <button className="btn btn-ghost btn-sm" onClick={startEditing}>
                    <Edit3 size={13} /> Editar
                  </button>
                )}
                {contract.status === 'draft' && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateStatus('sent')} disabled={updating}>
                    <Send size={13} /> Marcar enviado
                  </button>
                )}
                {contract.status === 'sent' && (
                  <button className="btn btn-primary btn-sm" onClick={() => updateStatus('signed')} disabled={updating}>
                    <CheckCircle size={13} /> Marcar firmado
                  </button>
                )}
                {contract.status === 'draft' && (
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--burgundy)' }} onClick={deleteContract}>
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', gap: 24, alignItems: 'flex-start' }}>

          {/* Contract document */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              background: 'white', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              padding: 40, border: '1px solid var(--border)', maxWidth: 720, margin: '0 auto',
            }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '2px solid var(--gold)' }}>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>{contract.contract_number}</div>
                {editing ? (
                  <input
                    className="form-input"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', border: '1px dashed var(--border)' }}
                  />
                ) : (
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--espresso)' }}>{contract.title}</div>
                )}
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--warm-gray)' }}>
                  {contract.venue_name} · {contract.client_name}
                </div>
                {contract.wedding_date && (
                  <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 4 }}>
                    Fecha del evento: {fmtDate(contract.wedding_date)}
                  </div>
                )}
              </div>

              {/* Parties */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 28, padding: '16px 20px', background: 'var(--surface)', borderRadius: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El prestador</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{contract.venue_name}</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>El cliente</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{contract.client_name}</div>
                  {contract.client_email && <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{contract.client_email}</div>}
                  {contract.client_nif && <div style={{ fontSize: 12, color: 'var(--warm-gray)' }}>{contract.client_nif}</div>}
                </div>
              </div>

              {/* Sections */}
              {editing ? (
                <div>
                  {editSections.map((s, idx) => (
                    <div key={idx} style={{ marginBottom: 20, padding: 16, border: '1px dashed var(--border)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontWeight: 600 }}>Cláusula {idx + 1}</span>
                        <input
                          className="form-input"
                          value={s.title}
                          onChange={e => updateSection(idx, 'title', e.target.value)}
                          style={{ flex: 1, fontSize: 14, fontWeight: 600 }}
                        />
                        <button className="btn btn-ghost btn-sm" onClick={() => removeSection(idx)} style={{ color: 'var(--burgundy)' }}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <textarea
                        className="form-input"
                        value={s.content}
                        onChange={e => updateSection(idx, 'content', e.target.value)}
                        rows={4}
                        style={{ resize: 'vertical', fontSize: 13, lineHeight: 1.6 }}
                      />
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" onClick={addSection}>
                    <Plus size={13} /> Añadir cláusula
                  </button>
                </div>
              ) : (
                <div>
                  {sections.map((s, idx) => (
                    <div key={idx} style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--espresso)', marginBottom: 6 }}>
                        {idx + 1}. {s.title}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.7, color: '#444', whiteSpace: 'pre-wrap' }}>
                        {s.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Financial summary */}
              {(Number(contract.total_amount) > 0 || Number(contract.deposit_amount) > 0) && (
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '2px solid var(--gold)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--espresso)' }}>Resumen económico</div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Importe total</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--espresso)' }}>{fmtEur(contract.total_amount)}</div>
                    </div>
                    <div style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginBottom: 4 }}>Señal de reserva</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{fmtEur(contract.deposit_amount)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Signatures area */}
              <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 40 }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Firma del venue</div>
                  {contract.venue_signature_url ? (
                    <div style={{ position: 'relative' }}>
                      <img src={contract.venue_signature_url} alt="Firma venue" style={{ maxHeight: 80, margin: '0 auto', display: 'block' }} />
                      <div style={{ fontSize: 10, color: 'green', marginTop: 4 }}>✓ Firmado {contract.venue_signed_at ? fmtDateShort(contract.venue_signed_at) : ''}</div>
                    </div>
                  ) : contract.venue_signed_at ? (
                    <div>
                      <div style={{ height: 60, borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'green' }}>✓ Firmado {fmtDateShort(contract.venue_signed_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSignModal('venue')}
                      style={{
                        width: '100%', height: 70, border: '2px dashed var(--border)', borderRadius: 8,
                        background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6, color: 'var(--warm-gray)', fontSize: 12,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <PenTool size={14} /> Firmar
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{contract.venue_name}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Firma del cliente</div>
                  {contract.client_signature_url ? (
                    <div style={{ position: 'relative' }}>
                      <img src={contract.client_signature_url} alt="Firma cliente" style={{ maxHeight: 80, margin: '0 auto', display: 'block' }} />
                      <div style={{ fontSize: 10, color: 'green', marginTop: 4 }}>✓ Firmado {contract.client_signed_at ? fmtDateShort(contract.client_signed_at) : ''}</div>
                    </div>
                  ) : contract.client_signed_at ? (
                    <div>
                      <div style={{ height: 60, borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
                        <span style={{ fontSize: 11, color: 'green' }}>✓ Firmado {fmtDateShort(contract.client_signed_at)}</span>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSignModal('client')}
                      style={{
                        width: '100%', height: 70, border: '2px dashed var(--border)', borderRadius: 8,
                        background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 6, color: 'var(--warm-gray)', fontSize: 12,
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <PenTool size={14} /> Firmar
                    </button>
                  )}
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{contract.client_name}</div>
                </div>
              </div>

              {/* Notes */}
              {editing ? (
                <div style={{ marginTop: 24 }}>
                  <label className="form-label">Notas internas (no visibles en el contrato)</label>
                  <textarea className="form-input" value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} style={{ resize: 'vertical' }} />
                </div>
              ) : contract.notes ? (
                <div style={{ marginTop: 24, padding: '10px 14px', background: '#fffbe6', borderRadius: 8, fontSize: 12, color: '#666' }}>
                  <strong>Notas internas:</strong> {contract.notes}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ width: 260, flexShrink: 0 }}>
            {/* Status */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Estado</div>
              <span className={`badge ${st.badge}`} style={{ fontSize: 13, padding: '4px 10px' }}>{st.label}</span>

              {contract.status !== 'cancelled' && contract.status !== 'completed' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {contract.status === 'draft' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('sent')} disabled={updating}>
                      <Send size={12} /> Marcar enviado
                    </button>
                  )}
                  {contract.status === 'sent' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('signed')} disabled={updating}>
                      <CheckCircle size={12} /> Marcar firmado
                    </button>
                  )}
                  {contract.status === 'signed' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('active')} disabled={updating}>
                      <CheckCircle size={12} /> Activar contrato
                    </button>
                  )}
                  {contract.status === 'active' && (
                    <button className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('completed')} disabled={updating}>
                      <CheckCircle size={12} /> Completar
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => updateStatus('cancelled')} disabled={updating}>
                    <XCircle size={12} /> Cancelar contrato
                  </button>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Información</div>
              {[
                ['Creado', fmtDateShort(contract.created_at)],
                contract.sent_at ? ['Enviado', fmtDateShort(contract.sent_at)] : null,
                contract.venue_signed_at ? ['Firmado (venue)', fmtDateShort(contract.venue_signed_at)] : null,
                contract.client_signed_at ? ['Firmado (cliente)', fmtDateShort(contract.client_signed_at)] : null,
                contract.wedding_date ? ['Fecha boda', fmtDateShort(contract.wedding_date)] : null,
              ].filter((x): x is [string, string] => x !== null).map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--warm-gray)' }}>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>

            {/* Lead association */}
            <div className="card" style={{ padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Lead asociado</div>
              {contract.lead_id ? (
                (() => {
                  const linkedLead = leads.find(l => l.id === contract.lead_id)
                  return (
                    <div>
                      <div style={{ padding: '8px 10px', background: 'var(--surface)', borderRadius: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--espresso)' }}>{linkedLead?.name || 'Lead'}</div>
                        {linkedLead?.email && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{linkedLead.email}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => router.push(`/leads?open=${contract.lead_id}`)}>
                          Ver
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11, color: 'var(--burgundy)' }} onClick={dissociateLead}>
                          Desvincular
                        </button>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <div>
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }} onClick={() => setShowLeadPicker(s => !s)}>
                    {showLeadPicker ? 'Cerrar' : '+ Asociar lead'}
                  </button>
                  {showLeadPicker && (
                    <div style={{ marginTop: 8 }}>
                      <input
                        className="form-input"
                        placeholder="Buscar por nombre o email..."
                        value={leadSearch}
                        onChange={e => setLeadSearch(e.target.value)}
                        style={{ fontSize: 12, marginBottom: 6 }}
                      />
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
                        {leads
                          .filter(l => !leadSearch || l.name.toLowerCase().includes(leadSearch.toLowerCase()) || (l.email || '').toLowerCase().includes(leadSearch.toLowerCase()))
                          .slice(0, 20)
                          .map(l => (
                            <button
                              key={l.id}
                              onClick={() => associateLead(l.id)}
                              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--ivory)', fontSize: 11 }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <div style={{ fontWeight: 600, color: 'var(--espresso)' }}>{l.name}</div>
                              {l.email && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{l.email}</div>}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Other links */}
            {(contract.budget_id || contract.invoice_id) && (
              <div className="card" style={{ padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--warm-gray)', marginBottom: 10, textTransform: 'uppercase' }}>Vinculado a</div>
                {contract.budget_id && (
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }} onClick={() => router.push(`/budgets/${contract.budget_id}`)}>
                    📋 Ver presupuesto
                  </button>
                )}
                {contract.invoice_id && (
                  <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }} onClick={() => router.push(`/facturas/${contract.invoice_id}`)}>
                    🧾 Ver factura
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature modal */}
      {showSignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowSignModal(null)}>
          <div style={{ background: 'white', borderRadius: 16, padding: '28px 32px', maxWidth: 480, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--espresso)' }}>
                  Firma digital — {showSignModal === 'venue' ? 'Venue' : 'Cliente'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 2 }}>
                  Dibuja tu firma en el recuadro
                </div>
              </div>
              <button onClick={clearCanvas} className="btn btn-ghost btn-sm" title="Borrar">
                <RotateCcw size={14} /> Borrar
              </button>
            </div>

            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              style={{
                width: '100%', height: 150, border: '2px solid var(--border)', borderRadius: 8,
                cursor: 'crosshair', background: '#fafaf8', touchAction: 'none',
              }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSignModal(null)}>
                Cancelar
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveSignature}>
                <PenTool size={12} /> Confirmar firma
              </button>
            </div>

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--surface)', borderRadius: 6, fontSize: 10, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
              Al firmar, confirmas que aceptas los términos del contrato. Esta firma tiene validez como acuerdo digital entre las partes.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
