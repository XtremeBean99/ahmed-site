import { Resend } from 'resend'

// Lazily created so the module can load without a RESEND_API_KEY at build time
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY environment variable is not set')
    _resend = new Resend(key)
  }
  return _resend
}

// TO: recipient address. Set CONTACT_TO_EMAIL in Vercel env vars.
// FROM: must match a domain verified in your Resend dashboard (resend.com/domains).
//       Set CONTACT_FROM_EMAIL or verify ahmedyhussain.com in Resend.
const TO = process.env.CONTACT_TO_EMAIL || 'ahmedyhussain07@gmail.com'
const FROM = process.env.CONTACT_FROM_EMAIL || 'Ahmed Hussain <noreply@ahmedyhussain.com>'

interface ContactEmailPayload {
  name: string
  email: string
  subject: string
  message: string
}

export async function sendContactEmail(payload: ContactEmailPayload) {
  const { name, email, subject, message } = payload
  const resend = getResend()

  await resend.emails.send({
    from: FROM,
    to: TO,
    replyTo: email,
    subject: `[ahmedyhussain.com] ${subject}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      message,
    ].join('\n'),
  })
}
