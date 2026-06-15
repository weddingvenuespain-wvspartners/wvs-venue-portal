'use client'
import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { useRequireSubscription } from '@/lib/use-require-subscription'
import Spinner from '@/components/Spinner'
import {
  ChevronLeft, ChevronDown, Phone, Mail, MessageCircle, Users, Calendar,
  Banknote, Tag, MapPin, Clock, FileText, ExternalLink, Edit2, Save, X,
  Landmark, UtensilsCrossed, Globe, Palette, Sparkles, CheckCircle2,
  Heart, Paperclip, CalendarCheck, Trash2, Receipt, CheckCircle, Inbox, Loader2,
  Plus, Circle, ClipboardList,
} from 'lucide-react'
import type { Client, ClientType } from '@/lib/clients'
import { CLIENT_TYPE_LABELS, CLIENT_TYPE_COLORS, isProfessional } from '@/lib/clients'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import DatePicker from '@/components/DatePicker'

// ── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  whatsapp_consent?: boolean | null
  source?: string | null
  status: string
  contact_type: string
  wedding_date?: string | null
  wedding_date_to?: string | null
  wedding_year?: number | null
  wedding_month?: number | null
  date_flexibility?: string | null
  guests?: number | null
  guests_adults?: number | null
  guests_children?: number | null
  budget?: string | null
  ceremony_type?: string | null
  catering_needed?: string | null
  language?: string | null
  style?: string | null
  notes?: string | null
  country?: string | null
  tags?: string[] | null
  visit_date?: string | null
  visit_time?: string | null
  visit_duration?: number | null
  initial_message?: string | null
  wedding_duration_days?: number | null
  budget_date?: string | null
  budget_date_to?: string | null
  budget_date_flexibility?: string | null
  budget_date_ranges?: { from: string; to: string }[] | null
  budget_file_url?: string | null
  budget_file_name?: string | null
  budget_files?: { url: string; name: string }[] | null
  original_wedding_date?: string | null
  original_wedding_date_to?: string | null
  original_date_flexibility?: string | null
  planner_id?: string | null
  created_at: string
  updated_at?: string | null
}

type Tab = 'info' | 'peticiones' | 'oferta' | 'tareas' | 'notas' | 'historial' | 'colaboracion'

type TaskPriority = 'alta' | 'media' | 'normal'
type TaskCategory = 'llamar' | 'enviar_dossier' | 'seguimiento' | 'visita' | 'otro'

type CrmTask = {
  id: string
  user_id: string
  venue_id: string
  title: string
  description?: string | null
  due_date: string
  type: 'internal' | 'lead'
  lead_id?: string | null
  completed: boolean
  completed_at?: string | null
  priority: TaskPriority
  category: TaskCategory
  created_at: string
}

const TASK_PRIORITY_CFG: Record<TaskPriority, { label: string; color: string; bg: string }> = {
  alta:   { label: 'Alta',   color: '#933B34', bg: '#FAF3F2' },
  media:  { label: 'Media',  color: '#92610E', bg: '#FEF9EE' },
  normal: { label: 'Normal', color: '#5C6B5E', bg: '#F2F4F2' },
}

const TASK_CATEGORY_CFG: Record<TaskCategory, { label: string; icon: string }> = {
  llamar:          { label: 'Llamar',          icon: '📞' },
  enviar_dossier:  { label: 'Enviar dossier',  icon: '📄' },
  seguimiento:     { label: 'Seguimiento',     icon: '🔄' },
  visita:          { label: 'Visita',           icon: '🏠' },
  otro:            { label: 'Otro',             icon: '📌' },
}

// ── Config ───────────────────────────────────────────────────────────────────

const PIPELINE: { key: string; label: string }[] = [
  { key: 'new',             label: 'Nuevo'      },
  { key: 'contacted',       label: 'Seguimiento' },
  { key: 'proposal_sent',   label: 'Propuesta'  },
  { key: 'visit_scheduled', label: 'Visita'     },
  { key: 'post_visit',      label: 'Post-visita' },
  { key: 'budget_sent',     label: 'Presupuesto' },
  { key: 'won',             label: 'Confirmado' },
]

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  new:             { label: 'Nuevo',              bg: '#EEF2F7', color: '#3F5980' },
  contacted:       { label: 'En seguimiento',     bg: '#F2F1F8', color: '#5C4E84' },
  proposal_sent:   { label: 'Propuesta enviada',  bg: '#fefce8', color: '#a16207' },
  visit_scheduled: { label: 'Visita agendada',    bg: '#EEF2EC', color: '#3C5945' },
  post_visit:      { label: 'Post-visita',        bg: '#EDF2ED', color: '#467A60' },
  budget_sent:     { label: 'Presupuesto enviado',bg: '#fff7ed', color: '#924E2A' },
  won:             { label: 'Confirmado',         bg: '#DCE7DE', color: '#35513E' },
  lost:            { label: 'Perdido',            bg: '#FAF3F2', color: '#933B34' },
}

const SOURCE_LABEL: Record<string, string> = {
  web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram',
  email: 'Email', referral: 'Referido', manual: 'Manual',
  other: 'Otro', wedding_planner: 'Wedding Planner',
  wedding_venues_spain: 'Wedding Venues Spain', bodas_net: 'Bodas.net',
}

const BUDGET_LABEL: Record<string, string> = {
  sin_definir: '—', menos_10k: '< 10k€', '10k_15k': '10–15k€',
  '15k_20k': '15–20k€', '20k_25k': '20–25k€', '25k_30k': '25–30k€',
  '30k_40k': '30–40k€', '40k_50k': '40–50k€', '50k_75k': '50–75k€',
  '75k_100k': '75–100k€', mas_100k: '> 100k€',
  menos_20k: '< 20k€', '20k_35k': '20–35k€', '35k_50k': '35–50k€', mas_50k: '> 50k€',
  wvs_menos_20k: '< 20k€', wvs_20k_35k: '20–35k€', wvs_35k_40k: '35–40k€',
  wvs_40k_51k: '40–51k€', wvs_51k_60k: '51–60k€', wvs_mas_60k: '> 60k€',
}

const PROPOSAL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Borrador',  color: '#7A5A2E', bg: '#F3EBD8' },
  sent:     { label: 'Enviado',   color: '#39527A', bg: '#DDE5EF' },
  viewed:   { label: 'Visto',     color: '#3C5945', bg: '#DCE7DE' },
  accepted: { label: 'Aceptado',  color: '#3C5945', bg: '#DDE7DF' },
  rejected: { label: 'Rechazado', color: '#933B34', bg: '#F2E2E0' },
}

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

function weddingLabel(lead: Lead): string {
  if (lead.wedding_date) {
    const from = fmtDate(lead.wedding_date)
    const to   = lead.wedding_date_to ? ` → ${fmtDate(lead.wedding_date_to)}` : ''
    return from + to
  }
  if (lead.wedding_year && lead.wedding_month) return `${MONTHS_SHORT[lead.wedding_month - 1]} ${lead.wedding_year}`
  if (lead.wedding_year) return String(lead.wedding_year)
  const flex = lead.date_flexibility
  if (flex === 'flexible') return 'Flexible (sin fecha definida)'
  if (flex === 'season')   return 'Por estación'
  return '—'
}

function budgetDatesLabel(lead: Lead): string {
  if (lead.budget_date) {
    const from = fmtDate(lead.budget_date)
    const to   = lead.budget_date_to ? ` → ${fmtDate(lead.budget_date_to)}` : ''
    return from + to
  }
  if (lead.budget_date_ranges && lead.budget_date_ranges.length > 0) {
    return lead.budget_date_ranges.map(r => `${fmtDate(r.from)}${r.to && r.to !== r.from ? ` → ${fmtDate(r.to)}` : ''}`).join(', ')
  }
  return '—'
}

function originalDatesLabel(lead: Lead): string {
  if (lead.original_wedding_date) {
    const from = fmtDate(lead.original_wedding_date)
    const to   = lead.original_wedding_date_to ? ` → ${fmtDate(lead.original_wedding_date_to)}` : ''
    return from + to
  }
  return '—'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 14 }}>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value, href, mono }: {
  icon: React.ReactNode; label: string; value: string | React.ReactNode; href?: string; mono?: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--ivory)', alignItems: 'flex-start' }}>
      <div style={{ color: 'var(--warm-gray)', flexShrink: 0, marginTop: 1 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 2 }}>{label}</div>
        {href ? (
          <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
            style={{ fontSize: 13, color: '#47648A', textDecoration: 'none', wordBreak: 'break-all', fontFamily: mono ? 'monospace' : undefined }}>
            {value}
          </a>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--charcoal)', wordBreak: 'break-word' }}>{value}</div>
        )}
      </div>
    </div>
  )
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  color: active ? 'var(--charcoal)' : 'var(--warm-gray)',
  background: active ? '#fff' : 'transparent',
  border: active ? '1px solid var(--ivory)' : '1px solid transparent',
  borderBottom: active ? '1px solid #fff' : '1px solid var(--ivory)',
  borderRadius: '6px 6px 0 0',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  position: 'relative',
  zIndex: active ? 1 : 0,
  marginBottom: -1,
})

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CrmClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const { user, loading: authLoading, activeVenue } = useAuth()
  const { isBlocked } = useRequireSubscription()
  const supabase = createClient()

  const [client,       setClient]       = useState<Client | null>(null)
  const [clientLeads,  setClientLeads]  = useState<Lead[]>([])
  const [proposals,    setProposals]    = useState<any[]>([])
  const [budgets,      setBudgets]      = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('info')
  // Detail modals
  const [peticionModal,   setPeticionModal]   = useState<Lead | null>(null)
  const [dosierModal,     setDosierModal]     = useState<any | null>(null)
  const [budgetModal,     setBudgetModal]     = useState<any | null>(null)
  const [modalDetail,     setModalDetail]     = useState<any>(null)
  const [loadingModal,    setLoadingModal]    = useState(false)
  const [editing,      setEditing]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [editForm,     setEditForm]     = useState({ name: '', email: '', phone: '', whatsapp: '', client_type: 'pareja' as ClientType, language: '', country: '' })

  // Notes auto-save
  const [notes, setNotes]       = useState('')
  const notesTimer              = useRef<ReturnType<typeof setTimeout> | null>(null)

  // WP couples
  const [couples,      setCouples]      = useState<(Client & { leadCount: number; latestStatus: string | null })[]>([])
  const [wpExpanded,   setWpExpanded]   = useState(false)

  // WP collaboration
  const [agreementForm, setAgreementForm] = useState({ commission_percent: '', commission_type: 'percentage', agreement_notes: '', agreement_start: '', agreement_end: '' })
  const [savingAgreement, setSavingAgreement] = useState(false)

  // Tasks
  const [crmTasks,       setCrmTasks]       = useState<CrmTask[]>([])
  const [taskModal,      setTaskModal]      = useState(false)
  const [editingTask,    setEditingTask]    = useState<CrmTask | null>(null)
  const [taskForm,       setTaskForm]       = useState({ title: '', description: '', due_date: '', type: 'lead' as 'internal' | 'lead', lead_id: '', priority: 'normal' as TaskPriority, category: 'otro' as TaskCategory })
  const [taskSaving,     setTaskSaving]     = useState(false)
  const [taskError,      setTaskError]      = useState('')

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/login'); return }
    if (!activeVenue) { setLoading(false); return }
    loadData()
  }, [user, authLoading, activeVenue?.id, id]) // eslint-disable-line

  const loadData = async () => {
    if (!activeVenue) return
    setLoading(true)

    const [clientRes, leadsRes, proposalsRes, budgetsRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).eq('venue_id', activeVenue.id).single(),
      supabase.from('leads').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('proposals').select('id, slug, couple_name, status, created_at, lead_id, wedding_date, guest_count, views, open_count').eq('venue_id', activeVenue.id),
      supabase.from('budgets').select('id, slug, couple_name, status, created_at, total_amount, payment_plan, lead_id, wedding_date, guest_count, open_count, line_items').eq('venue_id', activeVenue.id),
    ])

    if (!clientRes.data) {
      // Fallback: maybe the URL has a lead ID instead of client ID
      const { data: leadById } = await supabase.from('leads').select('client_id').eq('id', id).maybeSingle()
      if (leadById?.client_id) {
        router.replace(`/crm/${leadById.client_id}`)
        return
      }
      router.push('/crm')
      return
    }
    const c = clientRes.data as Client
    setClient(c)
    setNotes(c.notes ?? '')
    setEditForm({
      name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '', whatsapp: c.whatsapp ?? '',
      client_type: c.client_type ?? 'pareja', language: c.language ?? '', country: c.country ?? '',
    })

    // WP/professional agreement
    if (isProfessional(c.client_type)) {
      setAgreementForm({
        commission_percent: c.wp_commission_percent?.toString() ?? '',
        commission_type: c.wp_commission_type ?? 'percentage',
        agreement_notes: c.wp_agreement_notes ?? '',
        agreement_start: c.wp_agreement_start ?? '',
        agreement_end: c.wp_agreement_end ?? '',
      })
    }

    let leads = (leadsRes.data ?? []) as Lead[]

    // Fallback: if no leads linked by client_id, try other matching strategies
    if (leads.length === 0) {
      // Try by email
      if (c.email) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('email', c.email).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
      // Try by phone
      if (leads.length === 0 && c.phone) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('phone', c.phone).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
      // For professionals: also try by contact_type + name match
      if (leads.length === 0 && isProfessional(c.client_type) && c.name) {
        const { data } = await supabase.from('leads').select('*').eq('venue_id', activeVenue.id).eq('contact_type', c.client_type).ilike('name', c.name).order('created_at', { ascending: false })
        leads = (data ?? []) as Lead[]
      }
    }

    setClientLeads(leads)

    const leadIds = new Set(leads.map(l => l.id))
    setProposals((proposalsRes.data ?? []).filter((p: any) => p.lead_id && leadIds.has(p.lead_id)))
    setBudgets((budgetsRes.data ?? []).filter((b: any) => b.lead_id && leadIds.has(b.lead_id)))

    // Load tasks linked to this client's leads
    if (leadIds.size > 0) {
      const { data: tasksData } = await supabase.from('venue_tasks').select('*').in('lead_id', Array.from(leadIds)).order('due_date', { ascending: true })
      setCrmTasks((tasksData ?? []) as CrmTask[])
    } else {
      setCrmTasks([])
    }

    // Professional: load couples
    if (isProfessional(c.client_type)) {
      const { data: coupleData } = await supabase.from('clients').select('*').eq('parent_client_id', id).order('created_at', { ascending: false })
      if (coupleData && coupleData.length > 0) {
        const coupleIds = coupleData.map((cp: any) => cp.id)
        const { data: coupleLeadsData } = await supabase.from('leads').select('id, client_id, status, created_at').in('client_id', coupleIds).order('created_at', { ascending: false })
        const clMap: Record<string, { count: number; latestStatus: string | null }> = {}
        for (const cl of (coupleLeadsData ?? [])) {
          if (!clMap[cl.client_id]) clMap[cl.client_id] = { count: 0, latestStatus: cl.status }
          clMap[cl.client_id].count++
        }
        setCouples(coupleData.map((cp: any) => ({ ...cp, leadCount: clMap[cp.id]?.count ?? 0, latestStatus: clMap[cp.id]?.latestStatus ?? null })))
      } else {
        setCouples([])
      }
    }

    setLoading(false)
  }

  // ── Load modal detail data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!dosierModal && !budgetModal) { setModalDetail(null); return }
    const load = async () => {
      setLoadingModal(true)
      if (dosierModal) {
        const [{ data: menuSel }, { data: inqs }] = await Promise.all([
          supabase.from('proposal_menu_selections').select('*').eq('proposal_id', dosierModal.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.from('proposal_inquiries').select('*').eq('proposal_id', dosierModal.id).order('created_at', { ascending: false }),
        ])
        setModalDetail({ menuSelection: menuSel, inquiries: inqs || [] })
      } else if (budgetModal) {
        const { data: payments } = await supabase
          .from('budget_payments').select('*').eq('budget_id', budgetModal.id).eq('status', 'paid').order('paid_at', { ascending: false })
        setModalDetail({ payments: payments || [] })
      }
      setLoadingModal(false)
    }
    load()
  }, [dosierModal?.id, budgetModal?.id]) // eslint-disable-line

  // ── Notes auto-save ──────────────────────────────────────────────────────────
  const updateNotes = (val: string) => {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      await supabase.from('clients').update({ notes: val }).eq('id', id)
    }, 1000)
  }

  // ── Save edit ────────────────────────────────────────────────────────────────
  const saveEdit = async () => {
    setSaving(true)
    await supabase.from('clients').update({
      name: editForm.name.trim(),
      email: editForm.email.trim() || null,
      phone: editForm.phone.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      client_type: editForm.client_type,
      language: editForm.language.trim() || null,
      country: editForm.country.trim() || null,
    }).eq('id', id)
    setSaving(false)
    setEditing(false)
    loadData()
  }

  // ── Delete ───────────────────────────────────────────────────────────────────
  // ── Save WP agreement ─────────────────────────────────────────────────────
  const saveAgreement = async () => {
    setSavingAgreement(true)
    await supabase.from('clients').update({
      wp_commission_percent: agreementForm.commission_percent ? parseFloat(agreementForm.commission_percent) : null,
      wp_commission_type: agreementForm.commission_type,
      wp_agreement_notes: agreementForm.agreement_notes || null,
      wp_agreement_start: agreementForm.agreement_start || null,
      wp_agreement_end: agreementForm.agreement_end || null,
    }).eq('id', id)
    setSavingAgreement(false)
    loadData()
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  const todayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', due_date: '', type: 'lead', lead_id: clientLeads[0]?.id || '', priority: 'normal', category: 'otro' })
    setEditingTask(null)
    setTaskError('')
  }

  const openNewTask = (leadId?: string) => {
    resetTaskForm()
    setTaskForm(f => ({ ...f, due_date: todayIso, lead_id: leadId || clientLeads[0]?.id || '' }))
    setTaskModal(true)
  }

  const openEditCrmTask = (task: CrmTask) => {
    setEditingTask(task)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      due_date: task.due_date,
      type: task.type,
      lead_id: task.lead_id || '',
      priority: task.priority || 'normal',
      category: task.category || 'otro',
    })
    setTaskModal(true)
  }

  const saveCrmTask = async () => {
    if (!taskForm.title.trim()) { setTaskError('El título es obligatorio'); return }
    if (!taskForm.due_date) { setTaskError('La fecha límite es obligatoria'); return }
    if (!activeVenue) return
    setTaskSaving(true); setTaskError('')
    const payload: Record<string, any> = {
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      due_date: taskForm.due_date,
      type: taskForm.type,
      lead_id: taskForm.type === 'lead' && taskForm.lead_id ? taskForm.lead_id : null,
      priority: taskForm.priority,
      category: taskForm.category,
    }
    if (editingTask) {
      const { data, error: err } = await supabase.from('venue_tasks').update(payload).eq('id', editingTask.id).select().single()
      if (err) { setTaskError('Error al actualizar'); setTaskSaving(false); return }
      setCrmTasks(prev => prev.map(t => t.id === editingTask.id ? (data as CrmTask) : t).sort((a, b) => a.due_date.localeCompare(b.due_date)))
    } else {
      const { data, error: err } = await supabase.from('venue_tasks').insert({ ...payload, user_id: user!.id, venue_id: activeVenue.id }).select().single()
      if (err) { setTaskError('Error al crear'); setTaskSaving(false); return }
      setCrmTasks(prev => [...prev, data as CrmTask].sort((a, b) => a.due_date.localeCompare(b.due_date)))
    }
    setTaskModal(false)
    resetTaskForm()
    setTaskSaving(false)
  }

  const toggleCrmTask = async (task: CrmTask) => {
    const updates = { completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }
    await supabase.from('venue_tasks').update(updates).eq('id', task.id)
    setCrmTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } as CrmTask : t))
  }

  const deleteCrmTask = async (taskId: string) => {
    await supabase.from('venue_tasks').delete().eq('id', taskId)
    setCrmTasks(prev => prev.filter(t => t.id !== taskId))
  }

  const pendingTaskCount = crmTasks.filter(t => !t.completed).length

  const handleDelete = async () => {
    if (!confirm('Se eliminará este cliente. Sus peticiones se desvincularán pero no se borrarán.')) return
    await supabase.from('leads').update({ client_id: null }).eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    router.push('/crm')
  }

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (isBlocked) return null
  if (loading || authLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  )
  if (!client) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        <div style={{ padding: 40, color: 'var(--warm-gray)', fontSize: 14 }}>Cliente no encontrado.</div>
      </div>
    </div>
  )

  // ── Derived data ─────────────────────────────────────────────────────────────
  const tc = CLIENT_TYPE_COLORS[client.client_type] ?? CLIENT_TYPE_COLORS.otro
  const isWP = isProfessional(client.client_type)
  const latestLead = clientLeads[0] ?? null
  const activeLead = clientLeads.find(l => l.status !== 'lost' && l.status !== 'won') ?? latestLead
  const sc  = latestLead ? (STATUS_CFG[latestLead.status] || { label: latestLead.status, bg: '#f3f4f6', color: '#6b7280' }) : null
  const pipelineIdx = activeLead ? PIPELINE.findIndex(p => p.key === activeLead.status) : -1
  const isLost = latestLead?.status === 'lost' && !clientLeads.some(l => l.status !== 'lost')

  // Use activeLead for event details display
  const lead = activeLead ?? latestLead
  const isNewPhase  = lead ? (lead.status === 'new' || lead.status === 'lost') : true
  const isBudget    = lead ? (lead.status === 'budget_sent' || lead.status === 'won') : false
  const isActive    = lead ? (!isNewPhase && !isBudget) : false
  const hasVisit    = !!lead?.visit_date

  // Visit time display
  const visitTimeLabel = (() => {
    if (!lead?.visit_time) return ''
    if (!lead.visit_duration) return lead.visit_time
    const [h, m] = lead.visit_time.split(':').map(Number)
    const tot = h * 60 + m + lead.visit_duration
    const eh  = Math.floor(tot / 60) % 24
    const em  = tot % 60
    return `${lead.visit_time} – ${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')} (${lead.visit_duration} min)`
  })()

  // Documents from all leads
  const docFiles = clientLeads.flatMap(l => {
    const files: { url: string; name: string }[] = l.budget_files || []
    if (!files.length && l.budget_file_url) files.push({ url: l.budget_file_url, name: l.budget_file_name || 'Documento adjunto' })
    return files
  })

  // Contact info (prefer client, fallback to lead, for WP also check couples)
  const email    = client.email    || lead?.email    || (isWP ? clientLeads.find(l => l.email)?.email : undefined)
  const phone    = client.phone    || lead?.phone    || (isWP ? clientLeads.find(l => l.phone)?.phone : undefined)
  const whatsapp = client.whatsapp || lead?.whatsapp || (isWP ? clientLeads.find(l => l.whatsapp)?.whatsapp : undefined)
  const hasContactData = !!(email || phone || whatsapp)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout">
        {/* Topbar */}
        <div className="topbar" style={{ gap: 12 }}>
          <button onClick={() => router.push('/crm')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', fontSize: 13, padding: 0, fontFamily: 'Inter, sans-serif' }}>
            <ChevronLeft size={15} /> Contactos
          </button>
          <span style={{ color: '#d1cac3' }}>·</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--charcoal)' }}>{client.name}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <X size={13} /> Cancelar
                </button>
                <button onClick={saveEdit} disabled={saving} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Save size={13} /> {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </>
            ) : (
              <button onClick={handleDelete} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#933B34' }}>
                <Trash2 size={13} /> Eliminar
              </button>
            )}
          </div>
        </div>

        <div className="page-content">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: 20, alignItems: 'start' }}>

            {/* ── Left column ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Header card */}
              <div className="card" style={{ padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: tc.bg, border: `2px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: tc.color, flexShrink: 0 }}>
                    {(client.name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editing ? (
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }} />
                    ) : (
                      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', margin: '0 0 8px' }}>{client.name}</h1>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      {editing ? (
                        <Select value={editForm.client_type} onValueChange={(v) => setEditForm(f => ({ ...f, client_type: v as ClientType }))}>
                          <SelectTrigger style={{ fontSize: 12, padding: '3px 8px', border: '1px solid var(--ivory)', borderRadius: 6, background: tc.bg, color: tc.color, fontFamily: 'Inter, sans-serif', height: 'auto', width: 'auto' }}>
                            <SelectValue placeholder="Tipo de cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CLIENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, background: tc.bg, color: tc.color, borderRadius: 6, padding: '3px 10px', border: `1px solid ${tc.border}` }}>
                          {CLIENT_TYPE_LABELS[client.client_type] ?? client.client_type}
                        </span>
                      )}
                      {sc && (
                        <span style={{ fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, borderRadius: 6, padding: '3px 10px' }}>
                          {sc.label}
                        </span>
                      )}
                      {(client.country || client.language) && (
                        <span style={{ fontSize: 10, color: 'var(--warm-gray)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Globe size={9} /> {[client.country, client.language].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pipeline progress bar — from latest active lead */}
                {lead && !isLost && !isWP && (
                  <div style={{ marginTop: 20, paddingTop: 18, borderTop: '1px solid var(--ivory)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 2, background: 'var(--ivory)', zIndex: 0 }} />
                      <div style={{ position: 'absolute', top: 10, left: 10, height: 2, background: 'var(--gold)', zIndex: 1,
                        width: pipelineIdx < 0 ? '0%' : `${(pipelineIdx / (PIPELINE.length - 1)) * (100 - 20 / PIPELINE.length)}%`,
                        transition: 'width 0.3s',
                      }} />
                      {PIPELINE.map((step, i) => {
                        const done    = i < pipelineIdx
                        const current = i === pipelineIdx
                        return (
                          <div key={step.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, position: 'relative', zIndex: 2 }}>
                            <div style={{
                              width: 20, height: 20, borderRadius: '50%',
                              background: done ? 'var(--gold)' : current ? 'var(--espresso)' : '#fff',
                              border: `2px solid ${done || current ? (done ? 'var(--gold)' : 'var(--espresso)') : 'var(--ivory)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {done && <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>✓</span>}
                              {current && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', display: 'block' }} />}
                            </div>
                            <span style={{ fontSize: 9.5, fontWeight: current ? 700 : 500, color: current ? 'var(--espresso)' : done ? 'var(--gold)' : 'var(--warm-gray)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                              {step.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                {isLost && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--ivory)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#BC5249', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#933B34', fontWeight: 500 }}>Todos los leads perdidos</span>
                  </div>
                )}
              </div>

              {/* Visit banner */}
              {hasVisit && lead && (
                <div style={{ padding: '16px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#EDF2ED,#EEF2EC)', border: '1.5px solid #BFD2C5', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#5C8570', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Landmark size={18} style={{ color: '#fff' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#35513E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      {lead.status === 'post_visit' ? 'Visita realizada' : 'Visita agendada'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#3C5945' }}>
                      {fmtDate(lead.visit_date)}
                      {visitTimeLabel && <span style={{ fontWeight: 400, fontSize: 13, color: '#467A60' }}> · {visitTimeLabel}</span>}
                    </div>
                  </div>
                  <button onClick={() => router.push(`/leads?open=${lead.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.7)', border: '1px solid #C6D8C9', color: '#3C5945', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                    <ExternalLink size={11} /> Gestionar
                  </button>
                </div>
              )}

              {/* ── Tabs ──────────────────────────────────────────────────── */}
              <div>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--ivory)', gap: 0 }}>
                  {([...(['info', 'peticiones', 'oferta', 'tareas', 'notas', 'historial'] as Tab[]), ...(isWP ? ['colaboracion' as Tab] : [])]).map(t => (
                    <button key={t} onClick={() => setTab(t)} style={tabStyle(tab === t)}>
                      {{ info: 'Info', peticiones: `Peticiones (${clientLeads.length})`, oferta: `Oferta (${proposals.length + budgets.length + docFiles.length})`, tareas: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Tareas{pendingTaskCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#7E72A0', color: '#fff', borderRadius: 10, padding: '0 6px', minWidth: 18, textAlign: 'center', lineHeight: '18px' }}>{pendingTaskCount}</span>}</span>, notas: 'Notas', historial: 'Historial', colaboracion: 'Colaboración' }[t]}
                    </button>
                  ))}
                </div>

                <div className="card" style={{ padding: '20px 28px', borderTopLeftRadius: 0 }}>

                  {/* ── Tab: Info ───────────────────────────────────── */}
                  {tab === 'info' && (
                    <>
                      {/* Contact details */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Datos de contacto</SectionLabel>
                        {!editing && (
                          <button onClick={() => setEditing(true)} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 10px' }}>
                            <Edit2 size={12} /> Editar
                          </button>
                        )}
                      </div>
                      {editing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                          {[
                            { key: 'email',    label: 'Email',    type: 'email' },
                            { key: 'phone',    label: 'Teléfono', type: 'tel'   },
                            { key: 'whatsapp', label: 'WhatsApp', type: 'tel'   },
                          ].map(({ key, label, type }) => (
                            <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                              <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
                              <input type={type} className="form-input"
                                value={(editForm as any)[key] || ''}
                                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))} />
                            </div>
                          ))}
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Idioma</label>
                            <input className="form-input" value={editForm.language} onChange={e => setEditForm(f => ({ ...f, language: e.target.value }))} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>País</label>
                            <input className="form-input" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))} />
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginBottom: 20 }}>
                          {email    && <InfoRow icon={<Mail          size={14} />} label="Email"     value={email}    href={`mailto:${email}`} />}
                          {phone    && <InfoRow icon={<Phone         size={14} />} label="Teléfono"  value={phone}    href={`tel:${phone}`} />}
                          {whatsapp && <InfoRow icon={<MessageCircle size={14} />} label="WhatsApp"  value={whatsapp} href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} />}
                          {!email && !phone && !whatsapp && (
                            <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '8px 0 0' }}>Sin datos de contacto</p>
                          )}
                        </div>
                      )}

                      {/* Event details — from active/latest lead */}
                      {lead && (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <SectionLabel>Detalles del evento</SectionLabel>
                            <button onClick={() => router.push(`/leads?open=${lead.id}`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--gold)', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                              <Edit2 size={11} /> Editar en Leads
                            </button>
                          </div>
                          {isBudget && <InfoRow icon={<CalendarCheck size={14} />} label="Fechas confirmadas" value={budgetDatesLabel(lead)} />}
                          {isActive && <InfoRow icon={<Calendar size={14} />} label="Fechas propuestas" value={weddingLabel(lead)} />}
                          {lead.wedding_duration_days && lead.wedding_duration_days > 1 && (
                            <InfoRow icon={<Clock size={14} />} label="Duración" value={`${lead.wedding_duration_days} días`} />
                          )}
                          {!isNewPhase && originalDatesLabel(lead) !== '—' && (
                            <InfoRow icon={<FileText size={14} />} label="Fecha solicitada originalmente" value={originalDatesLabel(lead)} />
                          )}
                          {isNewPhase && <InfoRow icon={<Calendar size={14} />} label="Fecha deseada" value={weddingLabel(lead)} />}
                          <InfoRow icon={<Users size={14} />} label="Invitados" value={
                            lead.guests_adults || lead.guests_children
                              ? `${(lead.guests_adults || 0) + (lead.guests_children || 0)} total · ${lead.guests_adults || 0} adultos · ${lead.guests_children || 0} niños`
                              : lead.guests ? `${lead.guests}` : '—'
                          } />
                          <InfoRow icon={<Heart size={14} />} label="Ceremonia" value={
                            lead.ceremony_type && lead.ceremony_type !== 'sin_definir'
                              ? ({ civil: 'Civil', religiosa: 'Religiosa', simbolica: 'Simbólica', mixta: 'Mixta' }[lead.ceremony_type] || lead.ceremony_type)
                              : '—'
                          } />
                          <InfoRow icon={<UtensilsCrossed size={14} />} label="Catering" value={
                            lead.catering_needed && lead.catering_needed !== 'sin_definir'
                              ? ({ incluido: 'Incluido en el venue', externo: 'Traen catering externo', por_definir: 'Por definir' }[lead.catering_needed] || lead.catering_needed)
                              : '—'
                          } />
                          <InfoRow icon={<Banknote size={14} />} label="Presupuesto orientativo" value={
                            lead.budget && lead.budget !== 'sin_definir' ? (BUDGET_LABEL[lead.budget] || lead.budget) : '—'
                          } />
                          <InfoRow icon={<Globe   size={14} />} label="Idioma" value={lead.language || '—'} />
                          <InfoRow icon={<MapPin  size={14} />} label="País"   value={lead.country  || '—'} />
                          {lead.style && <InfoRow icon={<Palette size={14} />} label="Estilo buscado" value={lead.style} />}
                          {lead.tags && lead.tags.length > 0 && (
                            <div style={{ padding: '9px 0', borderBottom: '1px solid var(--ivory)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ color: 'var(--warm-gray)', flexShrink: 0, marginTop: 1 }}><Tag size={14} /></div>
                              <div>
                                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warm-gray)', marginBottom: 5 }}>Etiquetas</div>
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {lead.tags.map(t => (
                                    <span key={t} style={{ fontSize: 11, background: 'var(--cream)', color: 'var(--warm-gray)', border: '1px solid var(--ivory)', borderRadius: 5, padding: '2px 8px' }}>{t}</span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Initial message */}
                      {lead?.initial_message && (
                        <div style={{ marginTop: 20 }}>
                          <SectionLabel>Mensaje inicial</SectionLabel>
                          <div style={{ padding: '12px 16px', borderRadius: 10, background: '#faf8f5', border: '1px solid var(--ivory)', fontSize: 13, color: 'var(--charcoal)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {lead.initial_message}
                          </div>
                        </div>
                      )}

                      {/* Documents */}
                      {docFiles.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                          <SectionLabel>Documentos adjuntos</SectionLabel>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {docFiles.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                                <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                </div>
                                <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {!lead && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', marginTop: 8 }}>
                          Sin peticiones registradas
                        </p>
                      )}
                    </>
                  )}

                  {/* ── Tab: Peticiones ─────────────────────────────── */}
                  {tab === 'peticiones' && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Peticiones ({clientLeads.length})</SectionLabel>
                        {clientLeads.length > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Click en una petición para ver detalles</span>
                        )}
                      </div>
                      {clientLeads.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin peticiones registradas</p>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {clientLeads.map(l => {
                          const ls = STATUS_CFG[l.status] || { label: l.status, bg: '#f3f4f6', color: '#6b7280' }
                          const dateLabel = l.budget_date ? fmtDate(l.budget_date) : l.wedding_date ? fmtDate(l.wedding_date) : l.wedding_year ? String(l.wedding_year) : '—'
                          return (
                            <button key={l.id} onClick={() => setPeticionModal(l)}
                              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 3 }}>{l.name || 'Sin nombre'}</div>
                                <div style={{ fontSize: 11, color: 'var(--warm-gray)', display: 'flex', gap: 10 }}>
                                  <span>{dateLabel}</span>
                                  {l.guests && <span><Users size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />{l.guests} inv.</span>}
                                </div>
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 600, background: ls.bg, color: ls.color, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>{ls.label}</span>
                              <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {/* ── Tab: Oferta ─────────────────────────────────── */}
                  {tab === 'oferta' && (
                    <>
                      {/* Dosieres */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <SectionLabel>Dosieres y presupuestos ({proposals.length + budgets.length})</SectionLabel>
                        {(proposals.length > 0 || budgets.length > 0) && (
                          <span style={{ fontSize: 10, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Click para ver detalles</span>
                        )}
                      </div>

                      {proposals.length === 0 && budgets.length === 0 && docFiles.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin dosieres, presupuestos ni documentos</p>
                      )}

                      {/* Dosieres list */}
                      {proposals.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Dosieres</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {proposals.map(p => {
                              const ps = PROPOSAL_STATUS[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
                              return (
                                <button key={p.id} onClick={() => setDosierModal(p)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
                                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--ivory)')}>
                                  <Sparkles size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{p.couple_name || 'Sin nombre'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{fmtDate(p.created_at)}</div>
                                  </div>
                                  <span style={{ fontSize: 10, fontWeight: 600, background: ps.bg, color: ps.color, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>{ps.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Presupuestos list */}
                      {budgets.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Presupuestos</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {budgets.map(b => {
                              const bs = PROPOSAL_STATUS[b.status] || { label: b.status, color: '#6b7280', bg: '#f3f4f6' }
                              const plan = (b.payment_plan || []) as any[]
                              const paidCount = plan.filter((p: any) => p.status === 'paid').length
                              return (
                                <button key={b.id} onClick={() => router.push(`/budgets/${b.id}`)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
                                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--ivory)')}>
                                  <Receipt size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>{b.couple_name || 'Sin nombre'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>
                                      {fmtDate(b.created_at)}
                                      {plan.length > 0 && <> · {paidCount}/{plan.length} cuotas</>}
                                    </div>
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--charcoal)', whiteSpace: 'nowrap', marginRight: 8 }}>
                                    {Number(b.total_amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                  </div>
                                  <span style={{ fontSize: 10, fontWeight: 600, background: bs.bg, color: bs.color, borderRadius: 5, padding: '3px 8px', flexShrink: 0 }}>{bs.label}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Budget files */}
                      {docFiles.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <SectionLabel>Documentos adjuntos ({docFiles.length})</SectionLabel>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {docFiles.map((f, i) => (
                              <a key={i} href={f.url} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                                <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                                </div>
                                <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── Tab: Tareas ─────────────────────────────────── */}
                  {tab === 'tareas' && (() => {
                    const pending = crmTasks.filter(t => !t.completed).sort((a, b) => a.due_date.localeCompare(b.due_date))
                    const done = crmTasks.filter(t => t.completed).sort((a, b) => (b.completed_at || b.due_date).localeCompare(a.completed_at || a.due_date))
                    const overdue = pending.filter(t => t.due_date < todayIso)
                    const upcoming = pending.filter(t => t.due_date >= todayIso)
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <SectionLabel>Tareas ({pending.length} pendientes)</SectionLabel>
                          <button onClick={() => openNewTask()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: 'none', background: '#7E72A0', color: '#fff', cursor: 'pointer' }}>
                            <Plus size={13} /> Nueva tarea
                          </button>
                        </div>

                        {crmTasks.length === 0 && (
                          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
                            <ClipboardList size={28} style={{ color: '#d1cac3', marginBottom: 8 }} />
                            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Sin tareas para este cliente</div>
                            <div style={{ fontSize: 11, color: '#c0bbb4', marginTop: 4 }}>Crea tareas de seguimiento, llamadas o envío de dossiers.</div>
                          </div>
                        )}

                        {overdue.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#BC5249', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Vencidas ({overdue.length})</div>
                            {overdue.map(task => {
                              const priCfg = TASK_PRIORITY_CFG[task.priority || 'normal']
                              const catCfg = TASK_CATEGORY_CFG[task.category || 'otro']
                              const linkedLead = task.lead_id ? clientLeads.find(l => l.id === task.lead_id) : null
                              return (
                                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ivory)' }}>
                                  <button onClick={() => toggleCrmTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0, color: '#BC5249' }}>
                                    <Circle size={17} />
                                  </button>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{task.title}</div>
                                    {task.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{task.description}</div>}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#BC5249' }}>{fmtDate(task.due_date)} · Vencida</span>
                                      {task.priority !== 'normal' && <span style={{ fontSize: 10, fontWeight: 600, background: priCfg.bg, color: priCfg.color, borderRadius: 5, padding: '1px 7px' }}>{priCfg.label}</span>}
                                      <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{catCfg.icon} {catCfg.label}</span>
                                      {linkedLead && <span style={{ fontSize: 10, background: '#E9E6F3', color: '#4F417A', borderRadius: 5, padding: '1px 7px', fontWeight: 500 }}>{linkedLead.name}</span>}
                                    </div>
                                  </div>
                                  <button onClick={() => openEditCrmTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#d1cac3', flexShrink: 0 }} title="Editar"><Edit2 size={13} /></button>
                                  <button onClick={() => deleteCrmTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#d1cac3', flexShrink: 0 }} title="Eliminar"><Trash2 size={13} /></button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {upcoming.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#7E72A0', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Pendientes ({upcoming.length})</div>
                            {upcoming.map(task => {
                              const priCfg = TASK_PRIORITY_CFG[task.priority || 'normal']
                              const catCfg = TASK_CATEGORY_CFG[task.category || 'otro']
                              const linkedLead = task.lead_id ? clientLeads.find(l => l.id === task.lead_id) : null
                              const isToday = task.due_date === todayIso
                              return (
                                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ivory)' }}>
                                  <button onClick={() => toggleCrmTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0, color: '#7E72A0' }}>
                                    <Circle size={17} />
                                  </button>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--charcoal)' }}>{task.title}</div>
                                    {task.description && <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{task.description}</div>}
                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: isToday ? 'var(--gold)' : 'var(--warm-gray)' }}>{isToday ? 'Hoy' : fmtDate(task.due_date)}</span>
                                      {task.priority !== 'normal' && <span style={{ fontSize: 10, fontWeight: 600, background: priCfg.bg, color: priCfg.color, borderRadius: 5, padding: '1px 7px' }}>{priCfg.label}</span>}
                                      <span style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{catCfg.icon} {catCfg.label}</span>
                                      {linkedLead && <span style={{ fontSize: 10, background: '#E9E6F3', color: '#4F417A', borderRadius: 5, padding: '1px 7px', fontWeight: 500 }}>{linkedLead.name}</span>}
                                    </div>
                                  </div>
                                  <button onClick={() => openEditCrmTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#d1cac3', flexShrink: 0 }} title="Editar"><Edit2 size={13} /></button>
                                  <button onClick={() => deleteCrmTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: '#d1cac3', flexShrink: 0 }} title="Eliminar"><Trash2 size={13} /></button>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {done.length > 0 && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Completadas ({done.length})</div>
                            {done.slice(0, 10).map(task => (
                              <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--ivory)', opacity: 0.6 }}>
                                <button onClick={() => toggleCrmTask(task)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 1, flexShrink: 0, color: '#5C8570' }}>
                                  <CheckCircle2 size={17} />
                                </button>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--warm-gray)', textDecoration: 'line-through' }}>{task.title}</div>
                                  <div style={{ fontSize: 11, color: '#c0bbb4', marginTop: 2 }}>{fmtDate(task.due_date)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* ── Tab: Notas ──────────────────────────────────── */}
                  {tab === 'notas' && (
                    <>
                      <SectionLabel>Notas internas</SectionLabel>
                      <textarea
                        className="form-input"
                        rows={8}
                        value={notes}
                        onChange={e => updateNotes(e.target.value)}
                        placeholder="Añade notas sobre este cliente…"
                        style={{ resize: 'vertical', fontSize: 13 }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--warm-gray)', marginTop: 6 }}>
                        Guardado automático
                      </div>
                    </>
                  )}

                  {/* ── Tab: Historial ────────────────────────────── */}
                  {tab === 'historial' && (
                    <>
                      <SectionLabel>Línea de tiempo</SectionLabel>
                      {(() => {
                        // Build timeline events from leads, proposals, and client creation
                        const events: { date: string; type: string; label: string; detail?: string; color: string }[] = []

                        // Client created
                        events.push({ date: client.created_at, type: 'contact', label: 'Contacto creado', color: '#5F6196' })

                        // Leads
                        for (const l of clientLeads) {
                          events.push({ date: l.created_at, type: 'lead', label: `Petición recibida`, detail: l.name || undefined, color: '#AC8B4C' })
                          if (l.status === 'won') {
                            events.push({ date: l.updated_at || l.created_at, type: 'won', label: 'Confirmado', detail: l.name || undefined, color: '#5C8570' })
                          }
                          if (l.status === 'lost') {
                            events.push({ date: l.updated_at || l.created_at, type: 'lost', label: 'Perdido', detail: l.name || undefined, color: '#BC5249' })
                          }
                          if (l.visit_date) {
                            events.push({ date: l.visit_date, type: 'visit', label: 'Visita agendada', detail: l.name || undefined, color: '#467A60' })
                          }
                        }

                        // Proposals
                        for (const p of proposals) {
                          events.push({ date: p.created_at, type: 'proposal', label: 'Dosier creado', detail: p.couple_name || undefined, color: '#7E72A0' })
                        }

                        events.sort((a, b) => b.date.localeCompare(a.date))

                        if (events.length === 0) {
                          return <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin actividad registrada</p>
                        }

                        return (
                          <div style={{ position: 'relative', paddingLeft: 24 }}>
                            {/* Vertical line */}
                            <div style={{ position: 'absolute', left: 7, top: 4, bottom: 4, width: 2, background: 'var(--ivory)' }} />
                            {events.map((ev, i) => (
                              <div key={i} style={{ position: 'relative', paddingBottom: i < events.length - 1 ? 20 : 0, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                {/* Dot */}
                                <div style={{ position: 'absolute', left: -20, top: 3, width: 12, height: 12, borderRadius: '50%', background: ev.color, border: '2px solid #fff', zIndex: 1 }} />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)' }}>{ev.label}</div>
                                  {ev.detail && <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginTop: 1 }}>{ev.detail}</div>}
                                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{fmtDate(ev.date)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      })()}
                    </>
                  )}

                  {/* ── Tab: Colaboración (WP only) ────────────────── */}
                  {tab === 'colaboracion' && isWP && (
                    <>
                      {/* Comisión */}
                      <SectionLabel>Acuerdo de comisión</SectionLabel>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Comisión</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', background: '#fff' }}>
                              <input type="number" className="form-input"
                                value={agreementForm.commission_percent}
                                onChange={e => setAgreementForm(f => ({ ...f, commission_percent: e.target.value }))}
                                placeholder="Ej: 10"
                                style={{ border: 'none', flex: 1, fontSize: 13 }} />
                              <span style={{ fontSize: 12, color: '#999', padding: '6px 10px', background: '#f9f8f6', borderLeft: '1px solid var(--border)', fontWeight: 600 }}>
                                {agreementForm.commission_type === 'percentage' ? '%' : '€'}
                              </span>
                            </div>
                          </div>
                          <div className="form-group" style={{ width: 140, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Tipo</label>
                            <Select value={agreementForm.commission_type}
                              onValueChange={(v) => setAgreementForm(f => ({ ...f, commission_type: v }))}>
                              <SelectTrigger className="form-input" style={{ fontSize: 13 }}>
                                <SelectValue placeholder="Tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="percentage">Porcentaje</SelectItem>
                                <SelectItem value="fixed">Fijo (€)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Inicio acuerdo</label>
                            <DatePicker value={agreementForm.agreement_start}
                              onChange={(v) => setAgreementForm(f => ({ ...f, agreement_start: v }))}
                              allowPast placeholder="dd/mm/aaaa" />
                          </div>
                          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: 11 }}>Fin acuerdo</label>
                            <DatePicker value={agreementForm.agreement_end}
                              onChange={(v) => setAgreementForm(f => ({ ...f, agreement_end: v }))}
                              allowPast placeholder="dd/mm/aaaa" />
                          </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: 11 }}>Notas del acuerdo</label>
                          <textarea className="form-input" rows={4}
                            value={agreementForm.agreement_notes}
                            onChange={e => setAgreementForm(f => ({ ...f, agreement_notes: e.target.value }))}
                            placeholder="Condiciones, acuerdos especiales…"
                            style={{ resize: 'vertical', fontSize: 13 }} />
                        </div>

                        <button onClick={saveAgreement} disabled={savingAgreement}
                          className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Save size={13} /> {savingAgreement ? 'Guardando…' : 'Guardar acuerdo'}
                        </button>
                      </div>

                      {/* Documentos WP */}
                      <SectionLabel>Documentos de colaboración</SectionLabel>
                      {(client.wp_documents ?? []).length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic' }}>Sin documentos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(client.wp_documents ?? []).map((doc, i) => (
                            <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#f9fafb', border: '1.5px solid var(--ivory)', textDecoration: 'none', color: 'var(--charcoal)' }}>
                              <Paperclip size={14} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                                {doc.type && <div style={{ fontSize: 10, color: 'var(--warm-gray)' }}>{doc.type}</div>}
                              </div>
                              <ExternalLink size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── WP: Parejas section (collapsible) ─────────────────── */}
              {isWP && (
                <div className="card" style={{ padding: '20px 28px' }}>
                  <button onClick={() => setWpExpanded(!wpExpanded)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: 0, textAlign: 'left' }}>
                    <SectionLabel>Parejas de este WP</SectionLabel>
                    <span style={{ fontSize: 11, color: 'var(--warm-gray)', fontWeight: 500, marginBottom: 14, marginLeft: 'auto' }}>
                      {couples.length} {couples.length === 1 ? 'pareja' : 'parejas'}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--warm-gray)', marginBottom: 14, transform: wpExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  </button>
                  {wpExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {couples.length === 0 && (
                        <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin parejas asociadas</p>
                      )}
                      {couples.map(cp => {
                        const cpSc = cp.latestStatus ? (STATUS_CFG[cp.latestStatus] || { label: cp.latestStatus, bg: '#f3f4f6', color: '#6b7280' }) : null
                        return (
                          <button key={cp.id} onClick={() => router.push(`/crm/${cp.id}`)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafaf8', border: '1px solid var(--ivory)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left', width: '100%' }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#F3EBD8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: '#7A5A2E' }}>
                              {(cp.name || '?')[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cp.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{cp.leadCount} {cp.leadCount === 1 ? 'petición' : 'peticiones'}</div>
                            </div>
                            {cpSc && (
                              <span style={{ fontSize: 10, fontWeight: 600, background: cpSc.bg, color: cpSc.color, borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{cpSc.label}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* ── Right sidebar ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Quick actions */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Acciones rápidas</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {email && (
                    <a href={`mailto:${email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#EFF3F7', color: '#3D5E78', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Mail size={13} /> Enviar email
                    </a>
                  )}
                  {whatsapp && (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#EEF2EC', color: '#3C5945', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: '#faf8f5', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                      <Phone size={13} /> Llamar
                    </a>
                  )}
                  {latestLead && (
                    <button onClick={() => router.push(`/leads?open=${latestLead.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 8, background: 'var(--ivory)', color: 'var(--charcoal)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', textAlign: 'left' }}>
                      <ExternalLink size={13} /> Ver pipeline en Leads
                    </button>
                  )}
                  {!hasContactData && !latestLead && (
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: 0 }}>Sin datos de contacto. Edita el cliente para añadirlos.</p>
                  )}
                  {!hasContactData && latestLead && (
                    <p style={{ fontSize: 12, color: 'var(--warm-gray)', fontStyle: 'italic', margin: '0 0 4px 0' }}>Sin datos de contacto directo.</p>
                  )}
                </div>
              </div>

              {/* Origen */}
              <div className="card" style={{ padding: '18px 20px' }}>
                <SectionLabel>Origen</SectionLabel>
                {latestLead?.source && <InfoRow icon={<Sparkles size={13} />} label="Canal" value={SOURCE_LABEL[latestLead.source] || latestLead.source} />}
                <InfoRow icon={<Clock size={13} />} label="Cliente desde" value={fmtDate(client.created_at)} />
                {latestLead && <InfoRow icon={<Clock size={13} />} label="Última petición" value={fmtDate(latestLead.created_at)} />}
              </div>

              {/* Client tags */}
              {client.tags && client.tags.length > 0 && (
                <div className="card" style={{ padding: '18px 20px' }}>
                  <SectionLabel>Etiquetas</SectionLabel>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {client.tags.map(t => (
                      <span key={t} style={{ fontSize: 11, background: 'var(--ivory)', color: 'var(--warm-gray)', borderRadius: 5, padding: '3px 8px' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Petición detail modal ─────────────────────────────────── */}
      {peticionModal && (() => {
        const l = peticionModal
        const ls = STATUS_CFG[l.status] || { label: l.status, bg: '#f3f4f6', color: '#6b7280' }
        return (
          <div className="modal-overlay" onClick={() => setPeticionModal(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
                <div className="modal-title">{l.name || 'Sin nombre'}</div>
                <div className="modal-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, background: ls.bg, color: ls.color, borderRadius: 5, padding: '3px 8px' }}>{ls.label}</span>
                  {l.source && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{SOURCE_LABEL[l.source] || l.source}</span>}
                </div>
                <button onClick={() => setPeticionModal(null)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6 }}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
                  {l.wedding_date && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>Fecha boda</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{weddingLabel(l)}</div>
                    </div>
                  )}
                  {l.guests && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>Invitados</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{l.guests}{l.guests_adults ? ` (${l.guests_adults} adultos${l.guests_children ? `, ${l.guests_children} niños` : ''})` : ''}</div>
                    </div>
                  )}
                  {l.budget && l.budget !== 'sin_definir' && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>Presupuesto</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{BUDGET_LABEL[l.budget] || l.budget}</div>
                    </div>
                  )}
                  {l.ceremony_type && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>Ceremonia</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{l.ceremony_type}</div>
                    </div>
                  )}
                  {l.language && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>Idioma</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{l.language}</div>
                    </div>
                  )}
                  {l.country && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 2 }}>País</div>
                      <div style={{ fontSize: 13, color: 'var(--charcoal)' }}>{l.country}</div>
                    </div>
                  )}
                </div>
                {l.email && (
                  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--charcoal)' }}>
                    <Mail size={12} style={{ color: 'var(--warm-gray)' }} /> {l.email}
                  </div>
                )}
                {l.phone && (
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--charcoal)' }}>
                    <Phone size={12} style={{ color: 'var(--warm-gray)' }} /> {l.phone}
                  </div>
                )}
                {l.initial_message && (
                  <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--cream)', borderRadius: 8, border: '1px solid var(--ivory)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', marginBottom: 4 }}>Mensaje inicial</div>
                    <div style={{ fontSize: 12, color: 'var(--charcoal)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.initial_message}</div>
                  </div>
                )}
                {l.notes && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#F7F3E8', borderRadius: 8, border: '1px solid #E2D4AE' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7A5A2E', textTransform: 'uppercase', marginBottom: 4 }}>Notas</div>
                    <div style={{ fontSize: 12, color: 'var(--charcoal)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.notes}</div>
                  </div>
                )}
                {l.visit_date && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#467A60' }}>
                    <CalendarCheck size={12} /> Visita: {fmtDate(l.visit_date)}{l.visit_time ? ` a las ${l.visit_time}` : ''}
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setPeticionModal(null)}>Cerrar</button>
                <div style={{ flex: 1 }} />
                <button className="btn btn-primary btn-sm" onClick={() => { setPeticionModal(null); router.push(`/leads?open=${l.id}`) }}>
                  <ExternalLink size={11} /> Ver en Leads
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Dosier detail modal ───────────────────────────────────── */}
      {dosierModal && (() => {
        const p = dosierModal
        const ps = PROPOSAL_STATUS[p.status] || { label: p.status, color: '#6b7280', bg: '#f3f4f6' }
        const KIND_LABEL: Record<string, string> = { visit: 'Visita solicitada', call: 'Llamada', video: 'Videollamada', menu: 'Pregunta sobre menú', menu_selection: 'Selección de menú', date_pick: 'Fecha confirmada', provider_selection: 'Proveedores propios', other: 'Consulta' }
        const KIND_EMOJI: Record<string, string> = { visit: '📍', call: '📞', video: '🎥', menu: '🍽️', menu_selection: '✅', date_pick: '📅', provider_selection: '🤝', other: '💬' }
        return (
          <div className="modal-overlay" onClick={() => setDosierModal(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={16} style={{ color: 'var(--gold)' }} />
                  {p.couple_name || 'Sin nombre'}
                </div>
                <div className="modal-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, background: ps.bg, color: ps.color, borderRadius: 5, padding: '3px 8px' }}>{ps.label}</span>
                  {p.wedding_date && <span style={{ fontSize: 11, color: 'var(--warm-gray)' }}>{fmtDate(p.wedding_date)}</span>}
                </div>
                <button onClick={() => setDosierModal(null)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6 }}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {loadingModal ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 0', color: 'var(--warm-gray)' }}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : modalDetail ? (
                  <>
                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--espresso)' }}>{p.open_count ?? p.views ?? 0}</div>
                        <div style={{ fontSize: 9, color: 'var(--warm-gray)', textTransform: 'uppercase' }}>Vistas</div>
                      </div>
                      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--cream)', border: '1px solid var(--ivory)', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--espresso)' }}>{modalDetail.inquiries?.length || 0}</div>
                        <div style={{ fontSize: 9, color: 'var(--warm-gray)', textTransform: 'uppercase' }}>Respuestas</div>
                      </div>
                    </div>

                    {/* Menu selection */}
                    {modalDetail.menuSelection && (() => {
                      const ms = modalDetail.menuSelection
                      return (
                        <div style={{ background: 'var(--cream)', border: '1px solid var(--ivory)', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Selección de menú</div>
                          {ms.selected_menu_name && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--espresso)', marginBottom: 4 }}>{ms.selected_menu_name}</div>}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, marginBottom: 4 }}>
                            {ms.guest_count && <span><Users size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {ms.guest_count} inv.</span>}
                            {ms.estimated_total != null && <span style={{ fontWeight: 600 }}>{ms.estimated_total.toLocaleString('es-ES')} €</span>}
                          </div>
                          {ms.selected_extras?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                              {ms.selected_extras.map((ext: string, i: number) => (
                                <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: 'rgba(99,102,241,0.08)', color: '#514C84', fontWeight: 500 }}>{ext}</span>
                              ))}
                            </div>
                          )}
                          {ms.comments && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--charcoal)', fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{ms.comments}</div>}
                        </div>
                      )
                    })()}

                    {/* Inquiries */}
                    {modalDetail.inquiries?.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Respuestas</div>
                        {modalDetail.inquiries.map((inq: any) => (
                          <div key={inq.id} style={{ padding: '8px 10px', background: inq.status === 'new' ? '#F7F3E8' : 'var(--cream)', border: `1px solid ${inq.status === 'new' ? '#E2D4AE' : 'var(--ivory)'}`, borderRadius: 8, marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                              <span>{KIND_EMOJI[inq.kind] ?? '💬'}</span>
                              <span style={{ fontWeight: 600, color: 'var(--charcoal)' }}>{KIND_LABEL[inq.kind] || inq.kind}</span>
                              {inq.status === 'new' && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 99, background: 'var(--gold)', color: '#fff', fontWeight: 700 }}>Nuevo</span>}
                              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--warm-gray)' }}>{fmtDate(inq.created_at)}</span>
                            </div>
                            {inq.message && <div style={{ fontSize: 11, color: 'var(--charcoal)', marginTop: 2, whiteSpace: 'pre-wrap' }}>{inq.message}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* No response */}
                    {!modalDetail.menuSelection && (modalDetail.inquiries?.length || 0) === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--warm-gray)' }}>
                        <Inbox size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
                        <div style={{ fontSize: 12 }}>La pareja aún no ha respondido al dosier</div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setDosierModal(null)}>Cerrar</button>
                <div style={{ flex: 1 }} />
                <a href={`/dossier/${p.id}/edit`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ExternalLink size={11} /> Ver dosier completo
                </a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Budget detail modal ───────────────────────────────────── */}
      {budgetModal && (() => {
        const b = budgetModal
        const bs = PROPOSAL_STATUS[b.status] || { label: b.status, color: '#6b7280', bg: '#f3f4f6' }
        const plan = (b.payment_plan || []) as any[]
        const paidCount = plan.filter((p: any) => p.status === 'paid').length
        const totalPaid = (modalDetail?.payments || []).reduce((s: number, p: any) => s + Number(p.amount), 0)
        return (
          <div className="modal-overlay" onClick={() => setBudgetModal(null)}>
            <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ position: 'relative', paddingRight: 48 }}>
                <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={16} style={{ color: 'var(--gold)' }} />
                  {b.couple_name || 'Sin nombre'}
                </div>
                <div className="modal-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, background: bs.bg, color: bs.color, borderRadius: 5, padding: '3px 8px' }}>{bs.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--espresso)' }}>
                    {Number(b.total_amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                  </span>
                </div>
                <button onClick={() => setBudgetModal(null)} style={{ position: 'absolute', top: '50%', right: 16, transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: 6 }}>
                  <X size={18} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
                {loadingModal ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px 0', color: 'var(--warm-gray)' }}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Payment progress */}
                    {plan.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warm-gray)' }}>Progreso de pagos</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: paidCount === plan.length ? '#4A6B52' : 'var(--espresso)' }}>
                            {paidCount}/{plan.length} cuotas
                          </div>
                        </div>
                        <div style={{ height: 6, background: 'var(--ivory)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                          <div style={{ height: '100%', width: `${plan.length > 0 ? (paidCount / plan.length) * 100 : 0}%`, background: paidCount === plan.length ? '#4A6B52' : 'var(--gold)', borderRadius: 3 }} />
                        </div>
                        {plan.map((inst: any, idx: number) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: inst.status === 'paid' ? '#EEF2EC' : 'var(--cream)', border: `1px solid ${inst.status === 'paid' ? '#C3D4C5' : 'var(--ivory)'}`, marginBottom: 4 }}>
                            {inst.status === 'paid' ? <CheckCircle size={12} style={{ color: '#4A6B52', flexShrink: 0 }} /> : <Clock size={12} style={{ color: 'var(--warm-gray)', flexShrink: 0 }} />}
                            <div style={{ flex: 1, fontSize: 12, color: 'var(--charcoal)' }}>{inst.label}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: inst.status === 'paid' ? '#4A6B52' : 'var(--espresso)' }}>
                              {Number(inst.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                            {inst.due_date && <div style={{ fontSize: 9, color: 'var(--warm-gray)' }}>{fmtDate(inst.due_date)}</div>}
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>
                          {totalPaid.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} pagado de {Number(b.total_amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </div>
                      </div>
                    )}

                    {/* Payment history */}
                    {(modalDetail?.payments?.length || 0) > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Historial de pagos</div>
                        {modalDetail.payments.map((pay: any) => (
                          <div key={pay.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 11, borderBottom: '1px solid var(--ivory)' }}>
                            <CheckCircle size={10} style={{ color: '#4A6B52', flexShrink: 0 }} />
                            <div style={{ flex: 1, color: 'var(--charcoal)' }}>{pay.payer_name || pay.payer_email || 'Pago'}</div>
                            <div style={{ fontWeight: 600, color: '#4A6B52' }}>{Number(pay.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                            {pay.paid_at && <div style={{ fontSize: 9, color: 'var(--warm-gray)' }}>{fmtDate(pay.paid_at)}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {plan.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--warm-gray)' }}>
                        <Receipt size={20} style={{ opacity: 0.3, marginBottom: 6 }} />
                        <div style={{ fontSize: 12 }}>Sin plan de pagos definido</div>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setBudgetModal(null)}>Cerrar</button>
                <div style={{ flex: 1 }} />
                <a href={`/budgets/${b.id}/edit`} className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <ExternalLink size={11} /> Ver presupuesto completo
                </a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Task create/edit modal */}
      {taskModal && (
        <div onClick={() => { setTaskModal(false); resetTaskForm() }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--charcoal)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={18} style={{ color: '#7E72A0' }} /> {editingTask ? 'Editar tarea' : 'Nueva tarea'}
              </div>
              <button onClick={() => { setTaskModal(false); resetTaskForm() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)' }}><X size={18} /></button>
            </div>

            {taskError && <div style={{ fontSize: 12, color: '#BC5249', marginBottom: 12, padding: '8px 12px', background: '#FAF3F2', borderRadius: 8 }}>{taskError}</div>}

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Título *</label>
              <input className="form-input" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Llamar para confirmar visita" autoFocus />
            </div>

            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Descripción (opcional)</label>
              <textarea className="form-input" value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles..." rows={2} style={{ resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Fecha límite *</label>
                <DatePicker value={taskForm.due_date} onChange={(v) => setTaskForm(f => ({ ...f, due_date: v }))} allowPast placeholder="dd/mm/aaaa" />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Categoría</label>
                <select className="form-input" style={{ fontSize: 12, height: 34, marginTop: 4 }}
                  value={taskForm.category} onChange={e => setTaskForm(f => ({ ...f, category: e.target.value as TaskCategory }))}>
                  {(Object.entries(TASK_CATEGORY_CFG) as [TaskCategory, { label: string; icon: string }][]).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Prioridad</label>
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {(['alta', 'media', 'normal'] as TaskPriority[]).map(p => (
                    <button key={p} type="button" onClick={() => setTaskForm(f => ({ ...f, priority: p }))}
                      style={{ flex: 1, fontSize: 10, fontWeight: 600, padding: '5px 2px', borderRadius: 6, border: '1.5px solid',
                        borderColor: taskForm.priority === p ? TASK_PRIORITY_CFG[p].color : 'var(--ivory)',
                        background: taskForm.priority === p ? TASK_PRIORITY_CFG[p].bg : 'transparent',
                        color: taskForm.priority === p ? TASK_PRIORITY_CFG[p].color : 'var(--warm-gray)', cursor: 'pointer' }}>
                      {TASK_PRIORITY_CFG[p].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: 11 }}>Lead vinculado</label>
                <select className="form-input" style={{ fontSize: 12, height: 34, marginTop: 4 }}
                  value={taskForm.lead_id} onChange={e => setTaskForm(f => ({ ...f, lead_id: e.target.value, type: e.target.value ? 'lead' : 'internal' }))}>
                  <option value="">Sin vincular</option>
                  {clientLeads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setTaskModal(false); resetTaskForm() }}>Cancelar</button>
              <button onClick={saveCrmTask} disabled={taskSaving}
                style={{ fontSize: 12, fontWeight: 600, padding: '8px 20px', borderRadius: 8, border: 'none', background: '#7E72A0', color: '#fff', cursor: taskSaving ? 'not-allowed' : 'pointer', opacity: taskSaving ? 0.7 : 1 }}>
                {taskSaving ? 'Guardando...' : editingTask ? 'Guardar cambios' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
