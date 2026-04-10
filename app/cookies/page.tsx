export default function CookiesPage() {
  const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
    paddingBottom: 32,
    borderBottom: '1px solid #ede8df',
  }
  const headingStyle: React.CSSProperties = {
    fontFamily: 'Manrope, sans-serif',
    fontSize: 20,
    fontWeight: 600,
    color: '#3b2a1a',
    marginBottom: 12,
  }
  const bodyStyle: React.CSSProperties = {
    fontSize: 14,
    color: '#4a3728',
    lineHeight: 1.8,
  }

  const cookies = [
    {
      name: 'wvs_theme',
      tipo: 'Técnica',
      duracion: 'Persistente',
      finalidad: 'Almacena la preferencia de tema visual del portal (claro u oscuro).',
    },
    {
      name: 'wvs_session_expiry',
      tipo: 'Técnica',
      duracion: 'Variable',
      finalidad: 'Controla la fecha de expiración de la sesión según la preferencia del usuario.',
    },
    {
      name: 'wvs_session_duration',
      tipo: 'Técnica',
      duracion: 'Persistente',
      finalidad: 'Guarda la preferencia de duración de sesión elegida por el usuario.',
    },
    {
      name: 'wvs_analytics_consent',
      tipo: 'Técnica',
      duracion: 'Persistente',
      finalidad: 'Registra si el usuario ha aceptado o rechazado las cookies analíticas.',
    },
    {
      name: 'sb-* (Supabase)',
      tipo: 'Técnica',
      duracion: 'Sesión / persistente',
      finalidad: 'Cookies de autenticación gestionadas por Supabase. Necesarias para mantener la sesión iniciada.',
    },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <a href="/dashboard" style={{ fontSize: 12, color: '#c9a84c', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          ← Volver al portal
        </a>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500, letterSpacing: '0.01em', color: '#3b2a1a', marginBottom: 8, lineHeight: 1.2 }}>
          Política de Cookies
        </h1>
        <p style={{ fontSize: 13, color: '#8c7b6b' }}>
          Última actualización: enero de 2025 · WVS Partners SL
        </p>
      </div>

      {/* 1. Qué son */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. ¿Qué son las cookies?</h2>
        <div style={bodyStyle}>
          <p>Las cookies son pequeños archivos de texto que se almacenan en tu navegador cuando visitas un sitio web. Se utilizan ampliamente para hacer que los sitios funcionen de manera más eficiente, así como para proporcionar información a los propietarios del sitio. Las cookies pueden ser técnicas (necesarias para el funcionamiento), analíticas (para medir el uso) o de marketing (para personalizar anuncios).</p>
        </div>
      </div>

      {/* 2. Tipos */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. Tipos de cookies que usamos</h2>
        <div style={bodyStyle}>
          <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>

            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>
                Cookies técnicas necesarias
              </div>
              <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.7 }}>
                Son imprescindibles para el funcionamiento del portal. Sin ellas, no podrías iniciar sesión ni usar las funcionalidades básicas. No requieren consentimiento y no pueden desactivarse.
              </p>
            </div>

            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>
                Cookies analíticas (opcionales)
              </div>
              <p style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.7 }}>
                Nos permiten entender cómo se utiliza el portal de forma agregada y anónima, para mejorar la experiencia. Solo se activan si has dado tu consentimiento en Configuración &gt; Privacidad y datos.
              </p>
            </div>

            <div style={{ padding: '16px 18px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                Cookies de marketing (opcionales)
              </div>
              <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.7 }}>
                En este momento no utilizamos cookies de marketing de terceros para publicidad. Si esto cambiara en el futuro, actualizaremos esta política y solicitaremos tu consentimiento.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tabla */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Listado de cookies utilizadas</h2>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#faf8f4' }}>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#8c7b6b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '2px solid #ede8df', whiteSpace: 'nowrap' }}>
                  Nombre
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#8c7b6b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '2px solid #ede8df', whiteSpace: 'nowrap' }}>
                  Tipo
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#8c7b6b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '2px solid #ede8df', whiteSpace: 'nowrap' }}>
                  Duración
                </th>
                <th style={{ textAlign: 'left', padding: '10px 14px', color: '#8c7b6b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', borderBottom: '2px solid #ede8df' }}>
                  Finalidad
                </th>
              </tr>
            </thead>
            <tbody>
              {cookies.map((cookie, i) => (
                <tr key={cookie.name} style={{ background: i % 2 === 0 ? 'transparent' : '#faf8f4' }}>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #ede8df', verticalAlign: 'top' }}>
                    <code style={{ fontSize: 12, fontFamily: 'monospace', background: '#f0ebe3', padding: '2px 6px', borderRadius: 4, color: '#3b2a1a' }}>
                      {cookie.name}
                    </code>
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #ede8df', verticalAlign: 'top', color: '#4a3728', whiteSpace: 'nowrap' }}>
                    {cookie.tipo}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #ede8df', verticalAlign: 'top', color: '#4a3728', whiteSpace: 'nowrap' }}>
                    {cookie.duracion}
                  </td>
                  <td style={{ padding: '12px 14px', borderBottom: '1px solid #ede8df', verticalAlign: 'top', color: '#4a3728', lineHeight: 1.6 }}>
                    {cookie.finalidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Cómo desactivarlas */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Cómo gestionar o desactivar las cookies</h2>
        <div style={bodyStyle}>
          <p>Puedes controlar las cookies analíticas directamente desde el portal en <a href="/perfil?tab=privacidad" style={{ color: '#c9a84c' }}>Configuración &gt; Privacidad y datos</a>.</p>
          <p style={{ marginTop: 10 }}>Además, la mayoría de navegadores te permiten controlar las cookies a través de su configuración. A continuación encontrarás enlaces a las instrucciones de los navegadores más comunes:</p>
          <ul style={{ paddingLeft: 20, marginTop: 8 }}>
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener" style={{ color: '#c9a84c' }}>Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-" target="_blank" rel="noopener" style={{ color: '#c9a84c' }}>Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener" style={{ color: '#c9a84c' }}>Safari</a></li>
            <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener" style={{ color: '#c9a84c' }}>Microsoft Edge</a></li>
          </ul>
          <p style={{ marginTop: 10 }}>Ten en cuenta que deshabilitar las cookies técnicas necesarias puede afectar al funcionamiento del portal e impedir el inicio de sesión.</p>
        </div>
      </div>

      {/* 5. Contacto */}
      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0 }}>
        <h2 style={headingStyle}>5. Contacto</h2>
        <div style={bodyStyle}>
          <p>Si tienes alguna pregunta sobre nuestra política de cookies, puedes contactarnos en:</p>
          <div style={{ marginTop: 12, padding: '14px 18px', background: '#faf8f4', border: '1px solid #ede8df', borderRadius: 8 }}>
            <p><strong>WVS Partners SL</strong></p>
            <p style={{ marginTop: 4 }}>
              <a href="mailto:hola@weddingvenuesspain.com" style={{ color: '#c9a84c' }}>hola@weddingvenuesspain.com</a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid #ede8df', textAlign: 'center', fontSize: 12, color: '#b8a898' }}>
        Wedding Venues Spain Partner Portal · © 2025 ·{' '}
        <a href="/privacidad" style={{ color: '#c9a84c' }}>Política de Privacidad</a>
      </div>
    </div>
  )
}
