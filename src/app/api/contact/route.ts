import { NextRequest, NextResponse } from 'next/server'
import { contactSchema } from '@/lib/validations'
import { submitContact } from '@/services/contact'
import { checkRateLimit } from '@/lib/ratelimit'

export async function POST(request: NextRequest) {
  // Rate-limit by IP (Vercel provides x-forwarded-for)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = checkRateLimit(ip)
  if (!allowed) {
    return NextResponse.json(
      { error: 'You have sent too many messages. Please try again later.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = contactSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid form data.', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { name, email, subject, message, website } = parsed.data

  // Honeypot - silently succeed to confuse bots
  if (website && website.length > 0) {
    return NextResponse.json({ success: true })
  }

  try {
    await submitContact({ name, email, subject, message })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(
      '[contact] Email send failed. Check RESEND_API_KEY and that the sending domain is ' +
        'verified at resend.com/domains. Reason:',
      err instanceof Error ? err.message : 'unknown',
    )
    return NextResponse.json(
      { error: 'Unable to send your message right now. Please try again later.' },
      { status: 500 },
    )
  }
}
