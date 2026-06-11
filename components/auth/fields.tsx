'use client'
import { useState } from 'react'
import { ArrowIcon, SpinnerIcon, GoogleIcon, ShieldIcon, EuIcon, EyeIcon, EyeOffIcon } from './icons'

export function AuthField({
  label,
  icon,
  rightSlot,
  ...inputProps
}: {
  label: string
  icon?: React.ReactNode
  rightSlot?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: '#5F6B61', letterSpacing: '0.02em' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          className={`fe-input${icon ? ' has-icon' : ''}${rightSlot ? ' has-right' : ''}`}
          {...inputProps}
        />
        {icon && (
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9AA89E', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
            {icon}
          </span>
        )}
        {rightSlot}
      </div>
    </div>
  )
}

export function PasswordField({
  label,
  icon,
  ...inputProps
}: {
  label: string
  icon?: React.ReactNode
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <AuthField
      label={label}
      icon={icon}
      type={show ? 'text' : 'password'}
      rightSlot={
        <button type="button" className="fe-eye-btn" onClick={() => setShow(s => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
      {...inputProps}
    />
  )
}

export function AuthCheckbox({
  checked,
  onChange,
  flash = false,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  flash?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`fe-checkline${flash ? ' flash' : ''}`}>
      <input type="checkbox" className="fe-check-input" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="fe-checkbox" aria-hidden />
      <span style={{ fontSize: 12, color: 'rgba(20,30,22,0.65)', lineHeight: 1.5 }}>
        {children}
      </span>
    </label>
  )
}

export function AuthCta({ loading, loadingLabel, children }: { loading: boolean; loadingLabel: string; children: React.ReactNode }) {
  return (
    <button className="fe-cta" type="submit" disabled={loading}>
      <span>{loading ? loadingLabel : children}</span>
      <span className="fe-arrow">{loading ? <SpinnerIcon /> : <ArrowIcon />}</span>
    </button>
  )
}

export function AuthDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '14px 0 10px', color: '#9AA89E', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 500 }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(20,30,22,0.10)' }} />
      o continúa con
      <div style={{ flex: 1, height: 1, background: 'rgba(20,30,22,0.10)' }} />
    </div>
  )
}

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fe-social" style={{ width: '100%' }} onClick={onClick}>
      <GoogleIcon /> <span>Continuar con Google</span>
    </button>
  )
}

export function TrustBadges() {
  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 11, color: '#79857B' }}>
      <ShieldIcon /> <span>Cifrado RGPD</span>
      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5, display: 'inline-block' }} />
      <EuIcon /> <span>Servidores en la UE</span>
    </div>
  )
}

export function AuthBanner({ variant, children }: { variant: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const styles = {
    error:   { background: 'rgba(201,79,68,0.08)', border: '1px solid rgba(201,79,68,0.30)', color: '#B03A30' },
    success: { background: 'rgba(74,107,82,0.10)', border: '1px solid rgba(74,107,82,0.25)', color: '#3C5945' },
    info:    { background: 'rgba(74,107,82,0.07)', border: '1px solid rgba(74,107,82,0.20)', color: 'rgba(26,36,25,0.75)' },
  }[variant]
  return (
    <div style={{ ...styles, borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
      {children}
    </div>
  )
}
