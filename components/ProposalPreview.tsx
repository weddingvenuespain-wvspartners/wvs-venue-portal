'use client'
import { useEffect, useRef, useState } from 'react'
import { Monitor, Smartphone, RefreshCcw, ExternalLink, Loader2 } from 'lucide-react'

type PreviewPatch = Record<string, any>

export default function ProposalPreview({ slug, patch }: { slug: string; patch: PreviewPatch }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [loading, setLoading] = useState(true)
  const patchRef = useRef(patch)
  patchRef.current = patch

  // Remove loading overlay once iframe has loaded (or after 5s max)
  useEffect(() => {
    setLoading(true)
    const fallback = setTimeout(() => setLoading(false), 5000)
    const iframe = iframeRef.current
    const onLoad = () => {
      clearTimeout(fallback)
      setLoading(false)
    }
    iframe?.addEventListener('load', onLoad)
    return () => { clearTimeout(fallback); iframe?.removeEventListener('load', onLoad) }
  }, [slug, device])

  // Listen for ready signal from iframe, then send initial patch
  useEffect(() => {
    const onMessage = (e: MessageEvent<any>) => {
      if (e.data?.type === 'proposal-preview-ready') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'proposal-preview-update', patch: patchRef.current }, '*')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Send patch to iframe whenever it changes (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'proposal-preview-update', patch }, '*')
    }, 150)
    return () => clearTimeout(t)
  }, [patch])

  const reload = () => {
    setLoading(true)
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
  }

  const src = slug ? `/proposal/${slug}?preview=1` : ''
  const frameWidth = device === 'mobile' ? 390 : '100%'
  const frameHeight = device === 'mobile' ? 844 : '100%'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--cream)' }}>
      {/* Toolbar */}
      <div style={{
        flexShrink: 0, height: 48, padding: '0 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--ivory)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {(['desktop', 'mobile'] as const).map(d => {
              const active = device === d
              const Icon = d === 'desktop' ? Monitor : Smartphone
              const label = d === 'desktop' ? 'Desktop' : 'Móvil'
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDevice(d)}
                  title={`Vista ${label}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 11, fontWeight: 600,
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    background: active ? 'var(--gold)' : 'transparent',
                    color: active ? '#fff' : 'var(--warm-gray)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
                    transition: 'background .15s, color .15s',
                  }}
                >
                  <Icon size={13} /> {label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={reload}
            title="Recargar preview"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 500, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--warm-gray)' }}
          >
            <RefreshCcw size={12} />
          </button>
          {slug && (
            <a
              href={`/proposal/${slug}`}
              target="_blank"
              rel="noopener"
              title="Abrir en pestaña nueva"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 11, fontWeight: 500, textDecoration: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--warm-gray)' }}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Preview frame area */}
      {!slug ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warm-gray)', fontSize: 13, padding: 40, textAlign: 'center' }}>
          Guarda la propuesta para ver el preview en vivo.
        </div>
      ) : device === 'desktop' ? (
        <div style={{ flex: 1, minHeight: 0, position: 'relative', background: 'var(--surface)' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, color: 'var(--warm-gray)', fontSize: 12, gap: 8 }}>
              <Loader2 size={14} className="animate-spin" /> Cargando preview…
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={src}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            title="Preview propuesta"
          />
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, overflow: 'auto',
          background: 'repeating-linear-gradient(45deg, #f5f1e9, #f5f1e9 10px, #f0ebe1 10px, #f0ebe1 20px)',
        }}>
          <div style={{
            minHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            boxSizing: 'border-box',
          }}>
            <div style={{
              position: 'relative',
              width: frameWidth,
              height: frameHeight,
              maxWidth: '100%',
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 10px 40px rgba(0,0,0,.12)',
              overflow: 'hidden',
              border: '6px solid #1a1a1a',
              flexShrink: 0,
            }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, color: 'var(--warm-gray)', fontSize: 12, gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Cargando preview…
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={src}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title="Preview propuesta"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
