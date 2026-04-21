'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Palette, Upload, CheckCircle, Eye, RotateCcw } from 'lucide-react'

const PRESET_PALETTES = [
  { label: 'Dorado clásico',  primary: '#c4975a', secondary: '#f5f0ea' },
  { label: 'Rosa peonía',     primary: '#be185d', secondary: '#fdf2f8' },
  { label: 'Verde salvia',    primary: '#4a7c59', secondary: '#f0f5f1' },
  { label: 'Azul pizarra',    primary: '#334e68', secondary: '#f0f4f8' },
  { label: 'Terracota',       primary: '#c1440e', secondary: '#fdf4ee' },
  { label: 'Lavanda',         primary: '#7c3aed', secondary: '#f5f3ff' },
  { label: 'Grafito',         primary: '#374151', secondary: '#f9fafb' },
  { label: 'Rosado nude',     primary: '#d4a5a5', secondary: '#fef9f9' },
]

export default function BrandingPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [form, setForm] = useState({
    proposal_title:  '',
    brand_color:     '#c4975a',
    brand_color2:    '#f5f0ea',
    brand_logo_url:  '',
  })
  const [dataLoading, setDataLoading] = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError]     = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'wedding_planner') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!user || profile?.role !== 'wedding_planner') return
    const supabase = createClient()
    supabase.from('venue_profiles').select('proposal_title, brand_color, brand_color2, brand_logo_url').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setForm({
            proposal_title: data.proposal_title || '',
            brand_color:    data.brand_color    || '#c4975a',
            brand_color2:   data.brand_color2   || '#f5f0ea',
            brand_logo_url: data.brand_logo_url || '',
          })
        }
        setDataLoading(false)
      })
  }, [user?.id, profile?.role]) // eslint-disable-line

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('venue_profiles').update({
        proposal_title:  form.proposal_title.trim() || null,
        brand_color:     form.brand_color,
        brand_color2:    form.brand_color2,
        brand_logo_url:  form.brand_logo_url || null,
      }).eq('user_id', user!.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setLogoError('El archivo no puede superar 3MB'); return }
    setLogoError('')
    setUploadingLogo(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `branding/${user!.id}/logo.${ext}`
      const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      set('brand_logo_url', urlData.publicUrl)
    } catch (err: any) {
      setLogoError(err.message || 'Error al subir el logo')
    } finally {
      setUploadingLogo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--ivory)',
    background: 'var(--cream)', fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 6,
  }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1, maxWidth: 900 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 4 }}>Branding de propuesta</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Personaliza los colores y el logo que verá la pareja en su propuesta web.</p>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>

            {/* Left: form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* Título de la propuesta */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 16 }}>
                  Título de la propuesta
                </h2>
                <div>
                  <label style={labelSt}>Título o tagline</label>
                  <input
                    placeholder="Ej: Tu boda perfecta, curada con amor"
                    value={form.proposal_title}
                    onChange={e => set('proposal_title', e.target.value)}
                    style={inputSt}
                    maxLength={80}
                  />
                  <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 5 }}>
                    Aparece en la cabecera de la propuesta que ve la pareja. Si lo dejas vacío se usa el nombre de tu empresa.
                  </p>
                </div>
              </div>

              {/* Logo */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 16 }}>Logo</h2>

                {form.brand_logo_url ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--ivory)', marginBottom: 12 }}>
                    <img src={form.brand_logo_url} alt="Logo" style={{ height: 48, maxWidth: 120, objectFit: 'contain', borderRadius: 6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 2 }}>Logo cargado</div>
                      <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Haz clic en "Cambiar" para subir uno nuevo</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => fileRef.current?.click()}
                        style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--ivory)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--charcoal)' }}>
                        Cambiar
                      </button>
                      <button type="button" onClick={() => set('brand_logo_url', '')}
                        style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: '#dc2626' }}>
                        <RotateCcw size={11} style={{ display: 'inline', marginRight: 4 }} />Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileRef.current?.click()}
                    style={{ border: '2px dashed var(--ivory)', borderRadius: 10, padding: '28px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s', marginBottom: 12 }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                    onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--ivory)')}
                  >
                    {uploadingLogo ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--warm-gray)', fontSize: 13 }}>
                        <div style={{ width: 16, height: 16, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Subiendo…
                      </div>
                    ) : (
                      <>
                        <Upload size={24} style={{ color: 'var(--ivory)', marginBottom: 8 }} />
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 3 }}>Sube tu logo</div>
                        <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>PNG, JPG o SVG · máx. 3MB</div>
                      </>
                    )}
                  </div>
                )}

                {logoError && (
                  <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{logoError}</div>
                )}

                <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
              </div>

              {/* Colores */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--charcoal)', marginBottom: 16 }}>Paleta de colores</h2>

                {/* Presets */}
                <div style={{ marginBottom: 20 }}>
                  <label style={labelSt}>Paletas predefinidas</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {PRESET_PALETTES.map(p => {
                      const active = form.brand_color === p.primary && form.brand_color2 === p.secondary
                      return (
                        <button key={p.label} type="button"
                          onClick={() => { set('brand_color', p.primary); setForm(f => ({ ...f, brand_color: p.primary, brand_color2: p.secondary })) }}
                          style={{ padding: '8px 10px', borderRadius: 8, border: `2px solid ${active ? p.primary : 'var(--ivory)'}`, background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, transition: 'all 0.12s' }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.primary }} />
                            <div style={{ width: 16, height: 16, borderRadius: '50%', background: p.secondary, border: '1px solid var(--ivory)' }} />
                          </div>
                          <span style={{ fontSize: 10, color: active ? p.primary : 'var(--warm-gray)', fontWeight: active ? 700 : 400, textAlign: 'center', lineHeight: 1.2 }}>{p.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom pickers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelSt}>Color principal</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={form.brand_color} onChange={e => set('brand_color', e.target.value)}
                        style={{ width: 40, height: 36, padding: 2, borderRadius: 7, border: '1px solid var(--ivory)', cursor: 'pointer', background: 'none' }} />
                      <input type="text" value={form.brand_color} onChange={e => set('brand_color', e.target.value)}
                        style={{ ...inputSt, fontFamily: 'monospace', letterSpacing: '0.05em' }} maxLength={7} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Botones, enlaces, detalles</p>
                  </div>
                  <div>
                    <label style={labelSt}>Color de fondo / acento</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="color" value={form.brand_color2} onChange={e => set('brand_color2', e.target.value)}
                        style={{ width: 40, height: 36, padding: 2, borderRadius: 7, border: '1px solid var(--ivory)', cursor: 'pointer', background: 'none' }} />
                      <input type="text" value={form.brand_color2} onChange={e => set('brand_color2', e.target.value)}
                        style={{ ...inputSt, fontFamily: 'monospace', letterSpacing: '0.05em' }} maxLength={7} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>Fondo de secciones, tarjetas</p>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
                  {saved ? <><CheckCircle size={14} /> Guardado</> : saving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>

            </div>

            {/* Right: preview */}
            <div style={{ position: 'sticky', top: 32 }}>
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warm-gray)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Eye size={13} /> Vista previa
                </div>

                {/* Mock proposal header */}
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--ivory)' }}>
                  <div style={{ padding: '20px 18px', background: form.brand_color2, borderBottom: `3px solid ${form.brand_color}`, textAlign: 'center' }}>
                    {form.brand_logo_url ? (
                      <img src={form.brand_logo_url} alt="Logo" style={{ height: 40, maxWidth: 120, objectFit: 'contain', marginBottom: 8, display: 'block', margin: '0 auto 10px' }} />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: '50%', background: form.brand_color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', opacity: 0.9 }}>
                        <Palette size={20} color="#fff" />
                      </div>
                    )}
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 700, color: form.brand_color, marginBottom: 3 }}>
                      {form.proposal_title || 'Tu propuesta de boda'}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Preparada especialmente para vosotros</div>
                  </div>

                  {/* Mock venue card */}
                  <div style={{ padding: 14, background: '#fff' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Venue sugerido</div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: form.brand_color2, border: `1px solid ${form.brand_color}22` }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, background: form.brand_color, opacity: 0.15 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Finca El Jardín</div>
                        <div style={{ fontSize: 10, color: '#9ca3af' }}>Sevilla · Finca</div>
                      </div>
                      <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: form.brand_color, padding: '3px 8px', borderRadius: 6, background: `${form.brand_color}18` }}>
                        Disponible
                      </div>
                    </div>

                    {/* Mock button */}
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <div style={{ display: 'inline-block', padding: '8px 18px', borderRadius: 8, background: form.brand_color, color: '#fff', fontSize: 11, fontWeight: 600 }}>
                        Me encanta ❤️
                      </div>
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 10, textAlign: 'center', fontStyle: 'italic' }}>
                  Vista previa aproximada de la propuesta web
                </p>
              </div>
            </div>

          </div>
        )}

      </main>
      </div>
    </div>
  )
}
