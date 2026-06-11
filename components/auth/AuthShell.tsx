'use client'
import { useEffect } from 'react'

// Single source of truth for the auth-page styles. Light "liquid glass" canvas
// like the ForEventos landing hero (cream + soft sage glows); the dark
// night-green hero panel provides the contrast, gold marks the actions.
const AUTH_CSS = `
  @keyframes fe-twinkle {
    0%,100% { opacity: var(--fe-op, 0.6); transform: scale(1); }
    50% { opacity: 0.15; transform: scale(0.6); }
  }
  @keyframes fe-spin { to { transform: rotate(360deg); } }
  @keyframes fe-cardRise {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: none; }
  }
  @keyframes fe-shake {
    0%,100% { transform: none; }
    20%,60% { transform: translateX(-4px); }
    40%,80% { transform: translateX(4px); }
  }

  .fe-input {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border-radius: 12px;
    background: #FFFFFF;
    border: 1px solid rgba(20,30,22,0.12);
    color: #1A2419;
    font-size: 14.5px;
    font-weight: 400;
    font-family: 'Inter', sans-serif;
    transition: border-color .2s, box-shadow .2s, background .2s;
    outline: none;
    box-sizing: border-box;
    box-shadow: 0 1px 2px rgba(20,30,22,0.04);
  }
  .fe-input::placeholder { color: #9AA89E; }
  .fe-input:hover { border-color: rgba(20,30,22,0.22); }
  .fe-input:focus {
    border-color: #C9A35C;
    box-shadow: 0 0 0 3px rgba(216,179,106,0.22);
  }
  .fe-input.has-icon { padding-left: 42px; }
  .fe-input.has-right { padding-right: 42px; }

  .fe-cta {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 18px;
    border-radius: 10px;
    background: linear-gradient(180deg, #E8CC8F 0%, #D2A95F 100%);
    border: none;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 16px rgba(178,141,74,0.30);
    color: #241E10;
    font-weight: 600;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    height: 46px;
    transition: filter .15s, box-shadow .15s, transform .1s;
  }
  .fe-cta:hover:not(:disabled) { filter: brightness(1.04); box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 22px rgba(178,141,74,0.40); }
  .fe-cta:active:not(:disabled) { transform: translateY(1px); }
  .fe-cta:disabled { opacity: 0.6; cursor: wait; }
  .fe-cta .fe-arrow {
    display: inline-flex; align-items: center; justify-content: center;
    color: #241E10;
    transition: transform .2s cubic-bezier(0.16,1,0.3,1);
    flex-shrink: 0;
  }
  .fe-cta:hover:not(:disabled) .fe-arrow { transform: translateX(3px); }

  .fe-social {
    flex: 1;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 14px;
    border-radius: 12px;
    background: #FFFFFF;
    border: 1px solid rgba(20,30,22,0.12);
    color: #1A2419;
    font-size: 14px;
    font-weight: 500;
    font-family: 'Inter', sans-serif;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(20,30,22,0.04);
    transition: border-color .2s, box-shadow .2s, transform .2s;
  }
  .fe-social:hover { border-color: rgba(20,30,22,0.22); box-shadow: 0 3px 10px rgba(20,30,22,0.08); transform: translateY(-1px); }

  /* Checkbox: real <input> (keyboard + screen-reader support), styled box next to it */
  .fe-checkline { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; user-select: none; }
  .fe-check-input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  .fe-checkbox {
    width: 16px; height: 16px; border-radius: 5px; flex-shrink: 0; margin-top: 1px;
    border: 1px solid rgba(20,30,22,0.25);
    background: #FFFFFF;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all .2s;
  }
  .fe-check-input:checked + .fe-checkbox { background: #D2A95F; border-color: #D2A95F; }
  .fe-check-input:checked + .fe-checkbox::after {
    content: '';
    width: 8px; height: 4px;
    border-left: 1.8px solid #241E10;
    border-bottom: 1.8px solid #241E10;
    transform: rotate(-45deg) translate(0px,-1px);
  }
  .fe-check-input:focus-visible + .fe-checkbox { box-shadow: 0 0 0 3px rgba(216,179,106,0.30); }
  .fe-checkline.flash .fe-checkbox {
    animation: fe-shake .45s ease;
    border-color: rgba(201,79,68,0.6);
    box-shadow: 0 0 0 3px rgba(201,79,68,0.25);
  }

  .fe-btn-ghost {
    background: none; border: none; cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: color .2s;
  }

  .fe-eye-btn {
    position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    background: transparent; border: none; color: #9AA89E; cursor: pointer;
    transition: color .2s, background .2s;
  }
  .fe-eye-btn:hover { color: #8C6D2C; background: rgba(20,30,22,0.04); }

  .fe-hero { flex: 1; display: flex; min-width: 0; }
  .fe-brand { display: inline-flex; }
  .fe-form-brand { display: none; }

  html.login-no-scroll, html.login-no-scroll body { overflow: hidden; height: 100%; }

  @media (max-width: 900px) {
    .fe-hero { display: none !important; }
    .fe-split { flex-direction: column; }
    .fe-form-panel { padding: 64px 20px 24px !important; } /* clear the fixed Volver / ES bar */
    .fe-form-brand { display: inline-flex; }
  }
`

export function AuthShell({
  hero,
  topLeft,
  lockScroll = false,
  maxWidth = 420,
  children,
}: {
  hero?: React.ReactNode
  topLeft?: React.ReactNode
  lockScroll?: boolean
  maxWidth?: number
  children: React.ReactNode
}) {
  // Login must fit in one screen; signup is taller and may scroll.
  useEffect(() => {
    if (!lockScroll) return
    document.documentElement.classList.add('login-no-scroll')
    return () => { document.documentElement.classList.remove('login-no-scroll') }
  }, [lockScroll])

  return (
    <>
      <style>{AUTH_CSS}</style>

      {/* Cream canvas with soft sage glows — same treatment as the landing hero */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden',
        background: `
          radial-gradient(ellipse 80% 60% at 100% 50%, rgba(143,170,148,0.18), transparent 65%),
          radial-gradient(ellipse 60% 40% at 0% 0%, rgba(196,139,113,0.10), transparent 60%),
          radial-gradient(circle 600px at 12% 88%, rgba(74,107,82,0.10), transparent 60%),
          linear-gradient(180deg, #FBFAF5 0%, #F5F4EE 100%)
        `,
      }} />

      {/* App shell */}
      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        height: lockScroll ? '100vh' : undefined,
        overflow: lockScroll ? 'hidden' : undefined,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      }}>
        {topLeft && (
          <div style={{ position: 'fixed', top: 20, left: 24, zIndex: 50 }}>{topLeft}</div>
        )}

        <div style={{ position: 'fixed', top: 20, right: 24, zIndex: 50 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(20,30,22,0.10)', fontSize: 12, fontWeight: 500, color: '#5F6B61' }}>
            ES · €
          </span>
        </div>

        <div className="fe-split" style={{ flex: 1, display: 'flex', alignItems: 'stretch', padding: 16, gap: 16, minHeight: 0 }}>
          {hero && <div className="fe-hero">{hero}</div>}

          <div className="fe-form-panel" style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'clamp(20px, 4vh, 48px) clamp(20px, 4vw, 48px)',
            overflowY: lockScroll ? 'auto' : undefined,
          }}>
            <div style={{ width: '100%', maxWidth, animation: 'fe-cardRise .9s cubic-bezier(0.16,1,0.3,1) both' }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
