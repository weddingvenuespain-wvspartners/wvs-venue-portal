'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'
import { useAuth } from '@/lib/auth-context'
import { Save, CheckCircle, Building2, MapPin, Globe, Phone, User } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

export default function CateringFichaPage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()

  const [form, setForm] = useState({
    display_name: '', city: '', venue_type: '', phone: '', venue_website: '',
    first_name: '', last_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && profile && profile.role !== 'catering') router.replace('/dashboard')
  }, [loading, user, profile]) // eslint-disable-line

  useEffect(() => {
    if (!profile) return
    setForm({
      display_name:  profile.display_name  || '',
      city:          profile.city          || '',
      venue_type:    profile.venue_type    || '',
      phone:         profile.phone         || '',
      venue_website: profile.venue_website || '',
      first_name:    profile.first_name    || '',
      last_name:     profile.last_name     || '',
    })
    setDataLoading(false)
  }, [profile])

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { error: err } = await supabase
        .from('venue_profiles')
        .update({
          display_name:  form.display_name.trim(),
          city:          form.city.trim(),
          venue_type:    form.venue_type.trim(),
          phone:         form.phone.trim(),
          venue_website: form.venue_website.trim(),
          first_name:    form.first_name.trim(),
          last_name:     form.last_name.trim(),
          updated_at:    new Date().toISOString(),
        })
        .eq('user_id', user!.id)
      if (err) throw err
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e: any) {
      setError(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const CATERING_TYPES = ['Cocina española', 'Cocina mediterránea', 'Cocina internacional', 'Alta cocina', 'Food truck', 'Otro']

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--ivory)', background: 'var(--cream)',
    fontSize: 13, color: 'var(--charcoal)', outline: 'none',
    fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
  }
  const labelSt: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--charcoal)', marginBottom: 6 }

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <div className="main-layout"><main style={{ padding: '32px 40px', overflowY: 'auto', flex: 1 }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 4 }}>Mi ficha</h1>
          <p style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Información de tu empresa de catering que verán los wedding planners.</p>
        </div>

        {dataLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 800 }}>
              {/* Empresa */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Empresa</h2>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Nombre de la empresa</label>
                  <input value={form.display_name} onChange={e => set('display_name', e.target.value)} style={inputSt} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Ciudad</label>
                  <input value={form.city} onChange={e => set('city', e.target.value)} style={inputSt} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Tipo de cocina</label>
                  <Select value={form.venue_type || '__none__'} onValueChange={(v) => set('venue_type', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Seleccionar…</SelectItem>
                      {CATERING_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Teléfono</label>
                  <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Web</label>
                  <input value={form.venue_website} onChange={e => set('venue_website', e.target.value)} placeholder="https://tuempresa.com" style={inputSt} />
                </div>
              </div>

              {/* Contacto */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600, color: 'var(--charcoal)', marginBottom: 20 }}>Contacto</h2>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Nombre</label>
                  <input value={form.first_name} onChange={e => set('first_name', e.target.value)} style={inputSt} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelSt}>Apellidos</label>
                  <input value={form.last_name} onChange={e => set('last_name', e.target.value)} style={inputSt} />
                </div>

                <div style={{ background: 'rgba(196,151,90,0.06)', border: '1px solid rgba(196,151,90,0.15)', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: 'var(--warm-gray)', lineHeight: 1.5 }}>
                  Esta información es visible para los wedding planners que te soliciten disponibilidad.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <button type="submit" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 8, border: 'none', background: saved ? '#22c55e' : 'var(--charcoal)', color: '#fff', fontSize: 13, fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'Manrope, sans-serif', transition: 'background 0.3s' }}>
                {saved ? <><CheckCircle size={14} /> Guardado</> : <><Save size={14} /> Guardar cambios</>}
              </button>
            </div>
          </form>
        )}
      </main>
      </div>
    </div>
  )
}
