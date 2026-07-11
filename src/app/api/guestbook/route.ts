import { NextRequest, NextResponse } from 'next/server'
import { guestbookSchema } from '@/lib/validations'
import { addEntry, listEntries, deleteEntry } from '@/services/guestbook'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

// Drop ASCII control characters (codes 0-31 and DEL 127) and any HTML tags; keep normal text.
const stripUnsafe = (s: string) =>
  Array.from(s)
    .filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127 })
    .join('')
    .replace(/<[^>]*>/g, '')
    .trim()
const BAD = /\b(fuck|shit|cunt|nigg|faggot)\b/i // minimal; expand as needed

export async function GET() {
  try { return NextResponse.json({ entries: await listEntries(50) }) }
  catch { return NextResponse.json({ entries: [] }) } // fail soft (e.g. env unset)
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
  } catch { return NextResponse.json({ error: 'Could not save right now.' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id'); const key = searchParams.get('key')
  const admin = process.env.GUESTBOOK_ADMIN_KEY
  if (!admin || key !== admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 })
  await deleteEntry(id)
  return NextResponse.json({ success: true })
}
