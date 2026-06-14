import { NextRequest, NextResponse } from 'next/server'
import { contactSchema } from '@/lib/validations'
import { submitContact } from '@/services/contact'

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'

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

  // Honeypot — silently succeed to confuse bots
  if (website && website.length > 0) {
    return NextResponse.json({ success: true })
  }

  try {
    const result = await submitContact({ name, email, subject, message, ip })

    if ('rateLimited' in result) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in about an hour.' },
        { status: 429 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[contact] Submission failed:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(
      { error: 'Unable to process your message right now. Please try again later.' },
      { status: 500 },
    )
  }
}
