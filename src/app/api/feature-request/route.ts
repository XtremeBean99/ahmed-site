import { NextRequest, NextResponse } from 'next/server'
import { featureRequestSchema } from '@/lib/validations'
import { listFeatureRequests, submitFeatureRequest } from '@/services/feature-requests'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { isSameSiteRequest } from '@/lib/csrf'
import { adminKeyFrom, BAD_WORDS, secretMatches, stripUnsafe } from '@/lib/input'

/**
 * The desk's Request app: a visitor suggests a feature and it reaches the
 * owner's inbox (see services/feature-requests.ts). Same guards as the
 * guestbook: CSRF, IP rate limit (3/hr), honeypot, Zod, stripping.
 */
export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || 'ahmedyhussain.com'
  if (process.env.NODE_ENV === 'production') {
    const ok = isSameSiteRequest(request.headers.get('origin'), request.headers.get('referer'), host)
    if (!ok) return NextResponse.json({ success: true }) // silently reject cross-origin
  }
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`feature-request:${ip}`, 3)).allowed)
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const parsed = featureRequestSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  const { name = '', contact = '', message, website } = parsed.data
  if (website && website.length > 0) return NextResponse.json({ success: true }) // honeypot

  const clean = { name: stripUnsafe(name), contact: stripUnsafe(contact), message: stripUnsafe(message) }
  if (clean.message.length < 5 || BAD_WORDS.test(clean.name)) return NextResponse.json({ error: 'Request rejected.' }, { status: 400 })
  try {
    await submitFeatureRequest(clean)
    return NextResponse.json({ success: true })
  } catch (e) { console.error('[feature-request] POST failed', e); return NextResponse.json({ error: 'Could not send right now.' }, { status: 500 }) }
}

/** Admin: GET /api/feature-request with the guestbook admin key in a header lists the stored requests. */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`feature-request-admin:${ip}`, 30)).allowed)
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  const key = adminKeyFrom(request.headers)
  const admin = process.env.GUESTBOOK_ADMIN_KEY
  if (!admin || !key || !secretMatches(key, admin))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try { return NextResponse.json({ requests: await listFeatureRequests() }) }
  catch (e) { console.error('[feature-request] GET failed', e); return NextResponse.json({ error: 'Could not read right now.' }, { status: 500 }) }
}
