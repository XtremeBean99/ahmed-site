import { NextRequest, NextResponse } from 'next/server'
import { guestbookSchema } from '@/lib/validations'
import { addEntry, listEntries, deleteEntry, trimEntries } from '@/services/guestbook'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { getRedis } from '@/lib/redis'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time secret comparison. Both sides are hashed first so the compare
 * is over fixed-length buffers and the secret's length does not leak.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Admin key from `Authorization: Bearer <key>` or `X-Admin-Key`. Never a query param. */
function adminKeyFrom(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return request.headers.get('x-admin-key')?.trim() || null
}

// Drop ASCII control characters (codes 0-31 and DEL 127) and any HTML tags; keep normal text.
const stripUnsafe = (s: string) =>
  Array.from(s)
    .filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127 })
    .join('')
    .replace(/<[^>]*>/g, '')
    .trim()
const BAD = /\b(fuck|shit|cunt|nigg|faggot)\b/i // minimal; expand as needed

export async function GET(request: NextRequest) {
  // Health check: GET /api/guestbook?health=1 tests Redis connectivity
  if (request.nextUrl.searchParams.get('health') === '1') {
    try {
      const redis = getRedis()
      await redis.ping()
      return NextResponse.json({ ok: true, redis: 'connected' })
    } catch (e) {
      // Never return the error text: an Upstash client error can carry the REST
      // URL and token material. Log it server-side instead.
      console.error('[guestbook] health check failed', e)
      return NextResponse.json({ ok: false }, { status: 500 })
    }
  }
  try { return NextResponse.json({ entries: await listEntries(50) }) }
  catch (e) { console.error('[guestbook] GET failed', e); return NextResponse.json({ entries: [] }) }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const host = request.headers.get('host') || 'ahmedyhussain.com'
  const allowed = [`https://${host}`, `https://www.${host}`]
  if (process.env.NODE_ENV === 'production') {
    const ok = (origin && allowed.includes(origin)) || (referer && allowed.some((o) => referer.startsWith(o)))
    if (!ok) return NextResponse.json({ success: true }) // silently reject cross-origin
  }
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`guestbook:${ip}`)).allowed)
    return NextResponse.json({ error: 'Too many messages. Try again later.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const parsed = guestbookSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  const { name, message, website } = parsed.data
  if (website && website.length > 0) return NextResponse.json({ success: true }) // honeypot

  const cleanName = stripUnsafe(name), cleanMsg = stripUnsafe(message)
  if (!cleanName || !cleanMsg || BAD.test(cleanName) || BAD.test(cleanMsg))
    return NextResponse.json({ error: 'Message rejected.' }, { status: 400 })
  try {
    const entry = await addEntry({ name: cleanName, message: cleanMsg })
    return NextResponse.json({ success: true, entry })
  } catch (e) { console.error('[guestbook] POST failed', e); return NextResponse.json({ error: 'Could not save right now.' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Rate-limit BEFORE the auth check so the admin key cannot be brute-forced.
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`guestbook-admin:${ip}`, 30)).allowed)
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  // The key travels in a header, never the query string: query strings end up
  // in platform access logs, proxy logs and browser history.
  const key = adminKeyFrom(request)
  const admin = process.env.GUESTBOOK_ADMIN_KEY
  if (!admin || !key || !secretMatches(key, admin))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  // Bulk: DELETE /api/guestbook?trim=N  — keep only the N most recent entries
  const trim = searchParams.get('trim')
  if (trim !== null) {
    const n = parseInt(trim, 10)
    if (isNaN(n) || n < 0) return NextResponse.json({ error: 'trim must be a non-negative integer.' }, { status: 400 })
    const removed = await trimEntries(n)
    return NextResponse.json({ success: true, removed })
  }

  // Single: DELETE /api/guestbook?id=<uuid>
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id or trim parameter.' }, { status: 400 })
  await deleteEntry(id)
  return NextResponse.json({ success: true })
}
