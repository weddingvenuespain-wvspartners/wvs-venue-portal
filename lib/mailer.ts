import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mail.weddingvenuesspain.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: (process.env.SMTP_PORT || '465') === '465',
  auth: {
    user: process.env.SMTP_USER || 'noreply@weddingvenuesspain.com',
    pass: process.env.SMTP_PASS,
  },
})

type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  fromEmail: string
}

export async function sendProposalEmail({
  to,
  coupleName,
  venueName,
  venueEmail,
  proposalUrl,
  logoUrl,
  primaryColor,
  smtpConfig,
}: {
  to: string
  coupleName: string
  venueName: string
  venueEmail?: string | null
  proposalUrl: string
  logoUrl?: string | null
  primaryColor?: string | null
  smtpConfig?: SmtpConfig | null
}) {
  const color = primaryColor || '#2d4a7a'

  // Usar SMTP del venue si está configurado, si no el de la plataforma
  const activeTransporter = smtpConfig
    ? nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.port === 465,
        auth: { user: smtpConfig.user, pass: smtpConfig.pass },
        connectionTimeout: 10_000,
        greetingTimeout:   10_000,
        socketTimeout:     15_000,
      })
    : transporter

  const fromAddress = smtpConfig
    ? `"${venueName}" <${smtpConfig.fromEmail}>`
    : `"${venueName}" <noreply@weddingvenuesspain.com>`

  await activeTransporter.sendMail({
    from: fromAddress,
    ...(!smtpConfig && venueEmail ? { replyTo: `"${venueName}" <${venueEmail}>` } : {}),
    to,
    subject: `${coupleName} — Tu propuesta de boda en ${venueName}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3ED;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3ED;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr>
          <td align="center" style="padding-bottom:28px;">
            ${logoUrl
              ? `<img src="${logoUrl}" alt="${venueName}" style="height:40px;display:block;">`
              : `<span style="font-size:18px;font-weight:700;color:#453D23;letter-spacing:-0.3px;">${venueName}</span>`
            }
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;border-radius:16px;padding:44px 40px;box-shadow:0 2px 16px rgba(69,61,35,0.08);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding-bottom:20px;">
                  <h1 style="margin:0;font-size:22px;font-weight:700;color:#453D23;letter-spacing:-0.3px;">
                    Hola, ${coupleName} 💌
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:32px;">
                  <p style="margin:0;font-size:15px;color:#796F4E;line-height:1.7;">
                    Hemos preparado una propuesta personalizada para vuestra boda en
                    <strong style="color:#453D23;">${venueName}</strong>.
                    Aquí podéis ver todos los detalles, paquetes y opciones que hemos pensado para vosotros.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:36px;">
                  <a href="${proposalUrl}"
                    style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:16px 44px;border-radius:10px;letter-spacing:0.2px;">
                    Ver mi propuesta →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:24px;">
                  <p style="margin:0;font-size:13px;color:#9A8F78;line-height:1.6;text-align:center;">
                    ¿El botón no funciona? <a href="${proposalUrl}" style="color:#796F4E;">Haz click en este enlace</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #F0EDE6;padding-top:24px;">
                  <p style="margin:0;font-size:12px;color:#9A8F78;text-align:center;line-height:1.6;">
                    Este email ha sido enviado desde el portal de ${venueName}<br>a través de Wedding Venues Spain.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}

export async function sendActivationEmail(to: string, venueName: string) {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.weddingvenuesspain.com'

  await transporter.sendMail({
    from: '"Wedding Venues Spain" <noreply@weddingvenuesspain.com>',
    to,
    subject: '¡Tu cuenta ha sido activada! Ya puedes elegir tu plan',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F5F3ED;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3ED;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

        <tr>
          <td align="center" style="padding-bottom:28px;">
            <img src="https://weddingvenuesspain.com/wp-content/uploads/2024/10/logo-wedding-venues-spain-white-e1732122540714.png"
              alt="Wedding Venues Spain" style="height:32px;display:block;">
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;border-radius:16px;padding:44px 40px;box-shadow:0 2px 16px rgba(69,61,35,0.08);">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="width:56px;height:56px;background:#F5F3ED;border-radius:50%;display:inline-block;text-align:center;line-height:56px;font-size:24px;">✅</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:12px;">
                  <h1 style="margin:0;font-size:22px;font-weight:700;color:#453D23;letter-spacing:-0.3px;">
                    ¡Cuenta activada!
                  </h1>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:32px;">
                  <p style="margin:0;font-size:15px;color:#796F4E;line-height:1.6;max-width:380px;">
                    Hola${venueName ? ` <strong style="color:#453D23;">${venueName}</strong>` : ''},<br><br>
                    Tu venue ha sido verificado y tu cuenta ya está <strong style="color:#453D23;">activa</strong>.
                    Ahora puedes elegir el plan que mejor se adapta a tus necesidades y empezar a recibir leads de parejas.
                  </p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:32px;">
                  <a href="${portalUrl}/pricing"
                    style="display:inline-block;background:#453D23;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
                    Elegir mi plan →
                  </a>
                </td>
              </tr>
              <tr>
                <td style="border-top:1px solid #F0EDE6;padding-top:24px;">
                  <p style="margin:0;font-size:12px;color:#9A8F78;text-align:center;line-height:1.6;">
                    Si tienes alguna duda escríbenos a
                    <a href="mailto:info@weddingvenuesspain.com" style="color:#796F4E;">info@weddingvenuesspain.com</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding-top:24px;">
            <p style="margin:0;font-size:11px;color:#9A8F78;line-height:1.8;">
              Wedding Venues Spain · Partner Portal<br>
              <a href="mailto:info@weddingvenuesspain.com" style="color:#796F4E;text-decoration:none;">info@weddingvenuesspain.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}
