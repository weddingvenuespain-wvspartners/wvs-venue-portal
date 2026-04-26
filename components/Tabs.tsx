'use client'
// Standardized sticky tab bar — used across /proposals, /comunicacion, /estructura, /ficha…
//
// Renders right below the topbar (top: 64) with cream bg + 2px ivory bottom border.
// Each tab supports: icon (lucide), label, optional subtitle, optional badge.
// When `href` is set the tab is a <Link> (cross-page navigation, e.g. /proposals ↔ /proposals/templates).
// Otherwise it's a <button> calling `onChange(key)` on click.

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

export type TabItem = {
  key:    string
  label:  string
  icon?:  LucideIcon
  desc?:  string
  badge?: ReactNode
  href?:  string
}

type Props = {
  tabs:      TabItem[]
  activeKey: string
  onChange?: (key: string) => void
  /** Override the sticky `top` if the topbar in this page differs from default 64px */
  top?:      number
}

export default function Tabs({ tabs, activeKey, onChange, top = 64 }: Props) {
  return (
    <div style={{
      position: 'sticky', top, zIndex: 30,
      background: 'var(--cream)',
      borderBottom: '2px solid var(--ivory)',
      padding: '0 28px',
      display: 'flex', gap: 0,
    }}>
      {tabs.map(tab => {
        const isActive = tab.key === activeKey
        const Icon     = tab.icon
        const iconColor = isActive ? 'var(--gold)' : 'var(--warm-gray)'
        const sharedStyle: CSSProperties = {
          display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px',
          textDecoration: 'none',
          background: 'none', border: 'none',
          cursor: isActive ? 'default' : 'pointer',
          borderBottom: `2px solid ${isActive ? 'var(--gold)' : 'transparent'}`,
          marginBottom: -2,
          color: isActive ? 'var(--espresso)' : 'var(--warm-gray)',
          transition: 'all 0.15s',
        }

        const inner = (
          <>
            {Icon && <Icon size={15} color={iconColor} />}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{tab.label}</div>
              {tab.desc && <div style={{ fontSize: 10, color: 'var(--stone)' }}>{tab.desc}</div>}
            </div>
            {tab.badge}
          </>
        )

        if (tab.href) {
          return (
            <Link key={tab.key} href={tab.href} prefetch style={sharedStyle}>
              {inner}
            </Link>
          )
        }
        return (
          <button key={tab.key} type="button" onClick={() => !isActive && onChange?.(tab.key)} style={sharedStyle}>
            {inner}
          </button>
        )
      })}
    </div>
  )
}
