'use client'
import { useState, useRef, useEffect } from 'react'

export type ModalityOption = {
  id: string
  name: string
  description?: string | null
  duration_label?: string | null
  is_active?: boolean
}

interface ModalityPickerProps {
  value: string | null
  modalities: ModalityOption[]
  onChange: (id: string | null) => void
  placeholder?: string
}

export default function ModalityPicker({ value, modalities, onChange, placeholder = '— Sin modalidad —' }: ModalityPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? modalities.find(m => m.id === value) : null
  const active = modalities.filter(m => m.is_active !== false)
  const filtered = search.trim()
    ? active.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.description?.toLowerCase().includes(search.toLowerCase()))
    : active

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      {!open ? (
        <div
          onClick={() => { setOpen(true); setSearch('') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8,
            cursor: 'pointer', fontSize: 13, background: '#fff', minHeight: 38,
          }}
        >
          <span style={{ flex: 1, color: selected ? 'var(--text, #1a1a1a)' : 'var(--warm-gray, #9ca3af)' }}>
            {selected ? `${selected.name}${selected.duration_label ? ` · ${selected.duration_label}` : ''}` : placeholder}
          </span>
          {selected && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warm-gray)', padding: '0 2px', fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar modalidad…"
          style={{
            width: '100%', padding: '8px 10px', border: '1px solid var(--gold, #c8a951)',
            borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff',
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && filtered.length === 1) { onChange(filtered[0].id); setOpen(false) }
          }}
        />
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
          background: '#fff', border: '1px solid var(--border, #e5e7eb)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto', zIndex: 50,
        }}>
          {/* Clear option */}
          <div
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: 13,
              color: 'var(--warm-gray, #9ca3af)', borderBottom: '1px solid var(--border, #e5e7eb)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream, #faf7f2)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            {placeholder}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--warm-gray)', textAlign: 'center' }}>
              Sin resultados
            </div>
          ) : (
            filtered.map(m => (
              <div
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false) }}
                style={{
                  padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                  background: m.id === value ? 'var(--cream, #faf7f2)' : undefined,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream, #faf7f2)')}
                onMouseLeave={e => (e.currentTarget.style.background = m.id === value ? 'var(--cream, #faf7f2)' : '')}
              >
                <div style={{ fontWeight: 500, color: 'var(--text, #1a1a1a)' }}>
                  {m.name}
                  {m.duration_label && <span style={{ fontWeight: 400, color: 'var(--warm-gray)', marginLeft: 6 }}>· {m.duration_label}</span>}
                </div>
                {m.description && (
                  <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2, lineHeight: 1.3 }}>
                    {m.description.length > 80 ? m.description.slice(0, 80) + '…' : m.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
