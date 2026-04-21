'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { FileText, Plus, Send, Eye, Clock, Copy, CheckCircle } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = { draft: 'Borrador', sent: 'Enviada', viewed: 'Vista', expired: 'Expirada' }
const STATUS_COLOR: Record<string, string>  = { draft: 'var(--warm-gray)', sent: '#f59e0b', viewed: '#22c55e', expired: '#ef4444' }

export default function CateringPropuestasPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [proposals, setProposals] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // New proposal modal
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ couple_name: '', couple_email: '', guest_count: '', wedding_date: '', price_estimate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  const load = async () => {
    if (!user) return
    const supabase = createClient()
    const { data } = await supabase
      .from('proposals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setProposals(data || [])
    setDataLoading(false)
  }

  useEffect(() => { if (user && profile?.role === 'catering') load() }, [user?.id, profile?.role]) // eslint-disable-line

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.couple_name.trim()) { setFormError('Escribe el nombre de la pareja'); return }
    setSaving(true)
    setFormError('')
    try {
      const supabase = createClient()
      const slug = `${form.couple_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`
      const { error } = await supabase.from('proposals').insert({
        user_id:        user!.id,
        couple_name:    form.couple_name.trim(),
        couple_email:   form.couple_email.trim() || null,
        guest_count:    form.guest_count ? parseInt(form.guest_count) : null,
        wedding_date:   form.wedding_date || null,
        price_estimate: form.price_estimate ? parseFloat(form.price_estimate) : null,
        slug,
        status:         'draft',
        sections_data:  {},
        branding:       {},
      })
      if (error) throw error
      setShowModal(false)
      setForm({ couple_name: '', couple_email: '', guest_count: '', wedding_date: '', price_estimate: '', notes: '' })
      load()
    } catch (e: any) {
      setFormError(e.message || 'Error al crear la propuesta')
    } finally {
      setSaving(false)
    }
  }

  const copyLink = (slug: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/proposal/${slug}`)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--ivory)', background: 'var(--cream)',
    fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Propuestas</h1>
            <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Crea y envía propuestas de menú a tus clientes.</p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
            <Plus size={14} /> Nueva propuesta
          </button>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : proposals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <FileText size={40} style={{ color: 'var(--ivory)', marginBottom: 14 }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6 }}>Sin propuestas</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>Crea tu primera propuesta de menú</div>
            <button onClick={() => setShowModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer' }}>
              <Plus size={13} /> Crear propuesta
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {proposals.map((p: any) => (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(196,151,90,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={18} color="var(--gold)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 3 }}>{p.couple_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', gap: 10 }}>
                    {p.wedding_date && <span>{new Date(p.wedding_date).toLocaleDateString('es-ES')}</span>}
                    {p.guest_count && <span>{p.guest_count} inv.</span>}
                    {p.price_estimate && <span>{p.price_estimate.toLocaleString('es-ES')} €</span>}
                    {p.views > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} /> {p.views}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLOR[p.status], padding: '3px 8px', borderRadius: 8, background: `${STATUS_COLOR[p.status]}15` }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <button onClick={() => copyLink(p.slug, p.id)}
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--charcoal)' }}>
                    {copiedId === p.id ? <CheckCircle size={12} color="#22c55e" /> : <Copy size={12} />}
                    {copiedId === p.id ? 'Copiado' : 'Enlace'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 460 }}>
            <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 18, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Nueva propuesta</h2>

            {formError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{formError}</div>}

            <form onSubmit={handleCreate}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Pareja *</label>
                <input placeholder="María & Juan" value={form.couple_name} onChange={e => set('couple_name', e.target.value)} style={inputSt} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Email</label>
                <input type="email" placeholder="pareja@email.com" value={form.couple_email} onChange={e => set('couple_email', e.target.value)} style={inputSt} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Fecha boda</label>
                  <input type="date" value={form.wedding_date} onChange={e => set('wedding_date', e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Invitados</label>
                  <input type="number" placeholder="150" min={0} value={form.guest_count} onChange={e => set('guest_count', e.target.value)} style={inputSt} />
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 5 }}>Precio estimado (€)</label>
                <input type="number" placeholder="15000" min={0} value={form.price_estimate} onChange={e => set('price_estimate', e.target.value)} style={inputSt} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--ivory)', background: 'transparent', color: 'var(--charcoal)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando…' : 'Crear propuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
