export default function PrivacidadPage() {
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
  const listStyle: React.CSSProperties = {
    paddingLeft: 20,
    marginTop: 8,
    marginBottom: 8,
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <a href="/dashboard" style={{ fontSize: 12, color: '#c9a84c', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
          ← Volver al portal
        </a>
        <h1 style={{ fontFamily: 'Manrope, sans-serif', fontSize: 22, fontWeight: 500, letterSpacing: '0.01em', color: '#3b2a1a', marginBottom: 8, lineHeight: 1.2 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 13, color: '#8c7b6b' }}>
          Última actualización: enero de 2025 · WVS Partners SL
        </p>
      </div>

      {/* Intro */}
      <div style={{ padding: '16px 20px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 36, fontSize: 13, color: '#1d4ed8', lineHeight: 1.7 }}>
        En Wedding Venues Spain respetamos tu privacidad y nos comprometemos a proteger tus datos personales de conformidad con el Reglamento General de Protección de Datos (RGPD) y la Ley Orgánica de Protección de Datos (LOPDGDD). Esta política describe cómo recogemos, usamos y protegemos tus datos.
      </div>

      {/* 1. Responsable */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. Responsable del tratamiento</h2>
        <div style={bodyStyle}>
          <p>El responsable del tratamiento de tus datos personales es:</p>
          <div style={{ marginTop: 12, padding: '14px 18px', background: '#faf8f4', border: '1px solid #ede8df', borderRadius: 8 }}>
            <p><strong>WVS Partners SL</strong></p>
            <p style={{ marginTop: 4 }}>Email de contacto: <a href="mailto:hola@weddingvenuesspain.com" style={{ color: '#c9a84c' }}>hola@weddingvenuesspain.com</a></p>
            <p style={{ marginTop: 4 }}>Actividad: Plataforma digital para la gestión de venues de bodas</p>
          </div>
        </div>
      </div>

      {/* 2. Datos que recopilamos */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. Datos que recopilamos</h2>
        <div style={bodyStyle}>
          <p>Recopilamos los siguientes tipos de datos en el marco del uso del Portal de Partners:</p>
          <ul style={listStyle}>
            <li><strong>Datos de perfil:</strong> nombre, correo electrónico, teléfono, sitio web del venue y datos del negocio.</li>
            <li><strong>Datos de leads:</strong> información de contacto de parejas que solicitan información a través de tu ficha (nombre, email, teléfono, fecha de boda, número de invitados).</li>
            <li><strong>Datos de propuestas:</strong> contenido de propuestas personalizadas enviadas a potenciales clientes.</li>
            <li><strong>Datos de sesión:</strong> datos técnicos necesarios para gestionar tu acceso (tokens de sesión, fecha de último acceso).</li>
            <li><strong>Datos de suscripción y facturación:</strong> plan contratado, historial de pagos y eventos de suscripción.</li>
            <li><strong>Datos de uso (analytics):</strong> si lo consientes, recopilamos datos anónimos sobre el uso del portal para mejorar la plataforma.</li>
            <li><strong>Preferencias:</strong> configuración del portal, zona horaria, formato de fecha, preferencias de notificación.</li>
          </ul>
        </div>
      </div>

      {/* 3. Base legal */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Base legal del tratamiento</h2>
        <div style={bodyStyle}>
          <p>Tratamos tus datos con las siguientes bases legales:</p>
          <ul style={listStyle}>
            <li><strong>Ejecución del contrato:</strong> el tratamiento es necesario para prestarte los servicios del Portal de Partners (gestión de leads, propuestas, ficha del venue).</li>
            <li><strong>Interés legítimo:</strong> para la seguridad de la plataforma, la prevención de fraude y la mejora de nuestros servicios.</li>
            <li><strong>Consentimiento:</strong> para el envío de comunicaciones de marketing, el uso de cookies analíticas no esenciales y otras finalidades para las que hayas dado tu consentimiento explícito.</li>
            <li><strong>Obligación legal:</strong> en los casos en que la normativa vigente nos exija conservar ciertos datos (ej. registros de facturación).</li>
          </ul>
        </div>
      </div>

      {/* 4. Derechos RGPD */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Tus derechos</h2>
        <div style={bodyStyle}>
          <p>Como titular de los datos, tienes los siguientes derechos reconocidos por el RGPD:</p>
          <ul style={listStyle}>
            <li><strong>Acceso:</strong> puedes solicitar información sobre qué datos personales tuyos tratamos.</li>
            <li><strong>Rectificación:</strong> puedes corregir datos inexactos o incompletos desde tu perfil o contactando con nosotros.</li>
            <li><strong>Supresión (derecho al olvido):</strong> puedes solicitar la eliminación de tus datos cuando ya no sean necesarios para las finalidades para las que se recogieron.</li>
            <li><strong>Portabilidad:</strong> tienes derecho a recibir tus datos en un formato estructurado y legible por máquina. Puedes exportarlos directamente desde el portal en Configuración &gt; Privacidad y datos.</li>
            <li><strong>Oposición:</strong> puedes oponerte al tratamiento de tus datos para fines de marketing o cuando el tratamiento se base en interés legítimo.</li>
            <li><strong>Limitación:</strong> en determinadas circunstancias, puedes solicitar la limitación del tratamiento de tus datos.</li>
          </ul>
          <p style={{ marginTop: 12 }}>
            Para ejercer cualquiera de estos derechos, contacta con nosotros en{' '}
            <a href="mailto:hola@weddingvenuesspain.com" style={{ color: '#c9a84c' }}>hola@weddingvenuesspain.com</a>.
            Responderemos en un plazo máximo de 30 días. También puedes presentar una reclamación ante la{' '}
            <strong>Agencia Española de Protección de Datos (AEPD)</strong> en <a href="https://www.aepd.es" target="_blank" rel="noopener" style={{ color: '#c9a84c' }}>www.aepd.es</a>.
          </p>
        </div>
      </div>

      {/* 5. Conservación */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. Conservación de los datos</h2>
        <div style={bodyStyle}>
          <p>Conservamos tus datos mientras tu cuenta esté activa y sean necesarios para la prestación del servicio. Una vez que solicites la eliminación de tu cuenta, procederemos a borrar tus datos personales en un plazo máximo de 30 días, excepto aquellos que debamos conservar por obligación legal (como registros contables, que se conservan durante el período exigido por la normativa fiscal vigente).</p>
        </div>
      </div>

      {/* 6. Cookies */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. Cookies</h2>
        <div style={bodyStyle}>
          <p>Utilizamos cookies técnicas necesarias para el funcionamiento del portal y, con tu consentimiento, cookies analíticas para mejorar la experiencia. Para más información, consulta nuestra{' '}
            <a href="/cookies" style={{ color: '#c9a84c' }}>Política de Cookies</a>.
          </p>
        </div>
      </div>

      {/* 7. Seguridad */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. Seguridad de los datos</h2>
        <div style={bodyStyle}>
          <p>Aplicamos medidas técnicas y organizativas adecuadas para proteger tus datos personales frente a accesos no autorizados, pérdida, destrucción o alteración. Entre ellas se incluyen el cifrado de datos en tránsito (TLS/HTTPS), autenticación segura mediante Supabase Auth, y la posibilidad de activar la verificación en dos pasos (2FA) desde tu perfil.</p>
        </div>
      </div>

      {/* 8. Terceros */}
      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. Transferencias a terceros</h2>
        <div style={bodyStyle}>
          <p>No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Podemos compartir datos con proveedores de servicios que actúan como encargados del tratamiento bajo nuestras instrucciones y con las garantías adecuadas. En particular:</p>
          <ul style={listStyle}>
            <li><strong>Supabase Inc.</strong> (infraestructura de base de datos y autenticación) — con garantías bajo el Marco de Privacidad UE-EE.UU.</li>
            <li><strong>Vercel Inc.</strong> (hosting de la aplicación) — con garantías adecuadas de transferencia internacional.</li>
          </ul>
        </div>
      </div>

      {/* 9. Contacto */}
      <div style={{ ...sectionStyle, borderBottom: 'none', marginBottom: 0 }}>
        <h2 style={headingStyle}>9. Contacto</h2>
        <div style={bodyStyle}>
          <p>Si tienes cualquier duda sobre esta política de privacidad o sobre el tratamiento de tus datos, puedes contactarnos en:</p>
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
        <a href="/cookies" style={{ color: '#c9a84c' }}>Política de Cookies</a>
      </div>
    </div>
  )
}
