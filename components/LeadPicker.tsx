'use client'
import { useMemo, useRef, useState, useEffect } from 'react'
import { Search, User, X, ChevronDown } from 'lucide-react'

export type LeadOption = {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  guests?: number | null
  contact_type?: string | null
}

type Props = {
  value: string | null
  leads: LeadOption[]
  onChange: (id: string | null) => void
  placeholder?: string
  /** Optional badge color resolver for contact_type chips */
  typeColors?: Record<string, { bg: string; color: string; border: string }>
  /** Optional human label per contact_type */
  typeLabels?: Record<string, string>
  className?: string
}

/**
 * Searchable lead/contact picker with typeahead.
 * Displays a button showing the current selection; opens an inline dropdown
 * with a search input + filtered list (name, email, phone).
 */
export default function LeadPicker({ value, leads, onChange, placeholder = 'Buscar contacto…', typeColors, typeLabels, className }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => leads.find(l => l.id === value) || null, [leads, value])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return leads.slice(0, 25)
    return leads.filter(l => {
      const hay = `${l.name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 50)
  }, [leads, search])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30)
  }, [open])

  const renderTypeBadge = (t?: string | null) => {
    if (!t) return null
    const c = typeColors?.[t]
    const label = typeLabels?.[t] || t
    if (!c) {
      return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>{label}</span>
    }
    return <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>{label}</span>
  }

  return (
    <div ref={rootRef} className={className} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #e5e7eb)',
          background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 13, textAlign: 'left', color: selected ? 'var(--ink, #1f2937)' : 'var(--warm-gray, #9ca3af)',
        }}
      >
        <User size={14} style={{ color: 'var(--warm-gray, #9ca3af)', flexShrink: 0 }} />
        <div style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {selected ? selected.name : placeholder}
        </div>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            onClick={e => { e.stopPropagation(); onChange(null) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onChange(null) } }}
            title="Quitar vínculo"
            style={{ flexShrink: 0, display: 'inline-flex', cursor: 'pointer', color: 'var(--warm-gray, #9ca3af)' }}
          >
            <X size={13} />
          </span>
        )}
        {!selected && <ChevronDown size={14} style={{ color: 'var(--warm-gray, #9ca3af)', flexShrink: 0 }} />}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#fff', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8,
          boxShadow: '0 10px 30px rgba(0,0,0,.12)', maxHeight: 340, display: 'flex', flexDirection: 'column',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', padding: 8, borderBottom: '1px solid var(--ivory, #f3f4f6)' }}>
            <Search size={13} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--warm-gray, #9ca3af)' }} />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono…"
              style={{
                width: '100%', padding: '6px 8px 6px 28px', border: '1px solid var(--ivory, #f3f4f6)',
                borderRadius: 6, fontSize: 12, outline: 'none', background: '#fafafa',
              }}
            />
          </div>
          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px', fontSize: 12, color: 'var(--warm-gray, #9ca3af)', textAlign: 'center' }}>
                Sin resultados
              </div>
            ) : filtered.map(l => {
              const active = l.id === value
              return (
                <div
                  key={l.id}
                  onClick={() => { onChange(l.id); setOpen(false); setSearch('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer',
                    background: active ? 'var(--cream, #fef9f0)' : '#fff', borderBottom: '1px solid var(--ivory, #f3f4f6)',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget.style.background = 'var(--cream, #fef9f0)') }}
                  onMouseLeave={e => { if (!active) (e.currentTarget.style.background = '#fff') }}
                >
                  <User size={13} style={{ color: 'var(--warm-gray, #9ca3af)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink, #1f2937)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--warm-gray, #9ca3af)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[l.email, l.phone, l.guests ? `${l.guests} inv.` : null].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {renderTypeBadge(l.contact_type)}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
