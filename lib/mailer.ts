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
