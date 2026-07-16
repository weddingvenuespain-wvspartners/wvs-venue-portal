'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Phone, Mail, Users, Calendar, MessageSquare, Copy, Check, ChevronDown, Heart, Building2 } from 'lucide-react'

type OrphanLead = {
  id: string
  created_at: string
  venue_slug: string | null
  venue_name: string | null
  wp_venue_id: number | null
  name: string
  email: string | null
  phone: string | null
  guests: string | null
  wedding_date: string | null
  budget: string | null
  message: string | null
  wants_wedding_planner: boolean
  whatsapp_consent: boolean
  language: string | null
  status: string
  notes: string | null
}

const TABS = [
  { key: 'all',      label: 'Todos',                color: '#4A6B52' },
  { key: 'planner',  label: 'Con wedding planner',  color: '#a21caf' },
  { key: 'new',      label: 'Sin contactar',        color: '#E8A838' },
  { key: 'contacted',label: 'Contactados',          color: '#4F6D8C' },
] as const

type TabKey = typeof TABS[number]['key']

const STATUS_OPTIONS = [
  { value: 'new',        label: 'Sin contactar', color: '#E8A838' },
  { value: 'contacted',  label: 'Contactado',    color: '#4F6D8C' },
  { value: 'discarded',  label: 'Descartado',    color: '#6b7280' },
]

const BUDGET_LABEL: Record<string, string> = {
  sin_definir:     'Sin definir',
  wvs_menos_20k:   '< 20.000 €',
  wvs_20k_35k:     '20.000-35.000 €',
  wvs_35k_60k:     '35.000-60.000 €',
  wvs_60k_100k:    '60.000-100.000 €',
  wvs_mas_100k:    '> 100.000 €',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  const date = d.length <= 10 ? new Date(d + 'T12:00:00') : new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OrphanLeadsPage() {
  const router = useRouter()
  const { user, loading: authLoading, profile } = useAuth()
  const [leads, setLeads] = useState<OrphanLead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [statusMenuId, setStatusMenuId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!statusMenuId) return
    const close = () => setStatusMenuId(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [statusMenuId])

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (profile && profile.role !== 'admin') { router.push('/'); return }
    load()
  }, [user, authLoading, profile]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orphan_leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.error(error); setLoading(false); return }
    setLeads(data || [])
    setLoading(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const supabase = createClient()
    await supabase.from('orphan_leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    setStatusMenuId(null)
  }

  const copy = (txt: string, id: string) => {
    navigator.clipboard.writeText(txt)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const filtered = leads.filter(l => {
    if (activeTab === 'all') return true
    if (activeTab === 'planner') return l.wants_wedding_planner
    if (activeTab === 'new') return l.status === 'new'
    if (activeTab === 'contacted') return l.status === 'contacted'
    return true
  })

  const countBy = (fn: (l: OrphanLead) => boolean) => leads.filter(fn).length

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, padding: 40 }}>Cargando...</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, padding: '32px 40px', maxWidth: 1300 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontFamily: 'Inter, sans-serif', fontWeight: 600, color: 'var(--espresso)', margin: 0 }}>
            Leads huérfanos
          </h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 4 }}>
            Leads recibidos desde weddingvenuesspain.com de venues aún sin cuenta en el portal.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--ivory)' }}>
          {TABS.map(t => {
            const count = t.key === 'all' ? leads.length
              : t.key === 'planner' ? countBy(l => l.wants_wedding_planner)
              : countBy(l => l.status === t.key)
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  padding: '10px 18px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === t.key ? `2px solid ${t.color}` : '2px solid transparent',
                  fontSize: 13,
                  fontWeight: activeTab === t.key ? 600 : 500,
                  color: activeTab === t.key ? t.color : 'var(--warm-gray)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.key === 'planner' && <Heart size={12} />}
                {t.label}
                <span style={{ background: activeTab === t.key ? t.color : 'var(--ivory)', color: activeTab === t.key ? '#fff' : 'var(--warm-gray)', fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--warm-gray)', background: 'var(--cream)', borderRadius: 10 }}>
            Sin leads en esta pestaña.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(l => {
              const statusOpt = STATUS_OPTIONS.find(s => s.value === l.status) || STATUS_OPTIONS[0]
              return (
                <div key={l.id} style={{ background: '#fff', border: '1px solid var(--ivory)', borderRadius: 10, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--espresso)' }}>{l.name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>
                        Recibido {fmtDate(l.created_at)}
                        {l.language && ` · ${l.language.toUpperCase()}`}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatusMenuId(statusMenuId === l.id ? null : l.id) }}
                        style={{
                          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                          background: statusOpt.color + '20', color: statusOpt.color,
                          fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        {statusOpt.label} <ChevronDown size={12} />
                      </button>
                      {statusMenuId === l.id && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid var(--ivory)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 10, minWidth: 160 }}>
                          {STATUS_OPTIONS.map(o => (
                            <button
                              key={o.value}
                              onClick={() => updateStatus(l.id, o.value)}
                              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: o.color, fontWeight: l.status === o.value ? 700 : 500 }}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, background: 'var(--cream)', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                    <InfoRow icon={<Building2 size={12} />} label="Venue solicitado" value={l.venue_name || l.venue_slug || `WP #${l.wp_venue_id}`} />
                    <InfoRow icon={<Mail size={12} />} label="Email" value={l.email} copy={l.email ? () => copy(l.email!, l.id + '-email') : undefined} copied={copied === l.id + '-email'} />
                    <InfoRow icon={<Phone size={12} />} label="Teléfono" value={l.phone} copy={l.phone ? () => copy(l.phone!, l.id + '-phone') : undefined} copied={copied === l.id + '-phone'} />
                    <InfoRow icon={<Calendar size={12} />} label="Fecha boda" value={fmtDate(l.wedding_date)} />
                    <InfoRow icon={<Users size={12} />} label="Invitados" value={l.guests} />
                    <InfoRow icon={<MessageSquare size={12} />} label="Presupuesto" value={l.budget ? BUDGET_LABEL[l.budget] || l.budget : null} />
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    {l.wants_wedding_planner && (
                      <span style={{ padding: '3px 10px', borderRadius: 20, background: '#F6EEF2', border: '1px solid #f0abfc', fontSize: 11, fontWeight: 700, color: '#a21caf' }}>
                        <Heart size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        Quiere wedding planner
                      </span>
                    )}
                    {l.whatsapp_consent && (
                      <span style={{ padding: '3px 10px', borderRadius: 20, background: '#DDE7DF', border: '1px solid #C3D4C5', fontSize: 11, fontWeight: 700, color: '#4A6B52' }}>
                        ✓ Consiente WhatsApp
                      </span>
                    )}
                  </div>

                  {l.message && (
                    <div style={{ background: '#F9F7F2', padding: 12, borderRadius: 6, fontSize: 13, color: 'var(--espresso)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {l.message}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, copy, copied }: { icon: React.ReactNode; label: string; value: string | null; copy?: () => void; copied?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--espresso)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{value || '—'}</span>
        {copy && (
          <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4A6B52' : 'var(--warm-gray)', padding: 0 }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        )}
      </div>
    </div>
  )
}
