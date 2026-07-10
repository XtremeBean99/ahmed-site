import { Resend } from 'resend'

// Centralised contact email - used across the site (footer, legal, contact form).
// Change this once to update all references.
export const CONTACT_EMAIL = 'ahmedyhussain07@gmail.com'

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

// TO: recipient address. CONTACT_TO_EMAIL is recommended in production.
// Falls back to the CONTACT_EMAIL constant if not set.
// FROM: must match a domain verified in your Resend dashboard (resend.com/domains).
//       Set CONTACT_FROM_EMAIL or verify ahmedyhussain.com in Resend.
const TO = process.env.CONTACT_TO_EMAIL || CONTACT_EMAIL
const FROM = process.env.CONTACT_FROM_EMAIL || `Ahmed Hussain <noreply@ahmedyhussain.com>`

interface ContactEmailPayload {
  name: string
  email: string
  subject: string
  message: string
}

export async function sendContactEmail(payload: ContactEmailPayload) {
  const { name, email, subject, message } = payload
  const resend = getResend()

  // Sanitise email subject - strip control characters and newlines.
  const safeSubject = subject.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200)

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO,
    replyTo: email,
    subject: `[ahmedyhussain.com] ${safeSubject}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Subject: ${subject}`,
      '',
      message,
    ].join('\n'),
  })

  // Resend reports API errors (e.g. an unverified sending domain) in the
  // response body rather than by throwing. Surface them so the caller knows
  // the email did not actually go out.
  if (error) {
    throw new Error(`Resend delivery failed: ${error.message ?? 'unknown error'}`)
  }
}
