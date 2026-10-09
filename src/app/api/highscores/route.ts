import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { highscoreSchema } from '@/lib/validations'
import { listBoards, removeScore, submitScore } from '@/services/highscores'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { isSameSiteRequest } from '@/lib/csrf'
import { adminKeyFrom, BAD_WORDS, secretMatches, stripUnsafe } from '@/lib/input'
import { HISCORE_GAME_IDS, isPlausibleScore } from '@/lib/games/highscores'

/**
 * Public top 10 per desk game. Same guards as the guestbook: CSRF, IP rate
 * limit, honeypot, Zod, then stripping and a profanity check on the name; the
 * score must be a whole number inside the game's plausible range. Scores are
 * reported by the browser, so this keeps out junk, not a determined cheat.
 */
export async function GET() {
  try { return NextResponse.json({ boards: await listBoards() }) }
  catch (e) { console.error('[highscores] GET failed', e); return NextResponse.json({ boards: null }) }
}

export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || 'ahmedyhussain.com'
  if (process.env.NODE_ENV === 'production') {
    const ok = isSameSiteRequest(request.headers.get('origin'), request.headers.get('referer'), host)
    if (!ok) return NextResponse.json({ success: true }) // silently reject cross-origin
  }
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`highscores:${ip}`, 20)).allowed)
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const parsed = highscoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  const { game, name, score, website } = parsed.data
  if (website && website.length > 0) return NextResponse.json({ success: true }) // honeypot
  if (!isPlausibleScore(game, score)) return NextResponse.json({ error: 'Score rejected.' }, { status: 400 })

  const cleanName = stripUnsafe(name)
  if (!cleanName || BAD_WORDS.test(cleanName)) return NextResponse.json({ error: 'Name rejected.' }, { status: 400 })
  try {
    const rank = await submitScore(game, cleanName, score)
    return NextResponse.json({ success: true, rank })
  } catch (e) { console.error('[highscores] POST failed', e); return NextResponse.json({ error: 'Could not save right now.' }, { status: 500 }) }
}

const removeSchema = z.object({ game: z.enum(HISCORE_GAME_IDS), name: z.string().min(1).max(32) })

/** Admin: DELETE /api/highscores?game=snake&name=Cheater with the guestbook admin key in a header. */
export async function DELETE(request: NextRequest) {
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`highscores-admin:${ip}`, 30)).allowed)
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  const key = adminKeyFrom(request.headers)
  const admin = process.env.GUESTBOOK_ADMIN_KEY
  if (!admin || !key || !secretMatches(key, admin))
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const parsed = removeSchema.safeParse({ game: searchParams.get('game'), name: searchParams.get('name') })
  if (!parsed.success) return NextResponse.json({ error: 'Need game and name.' }, { status: 400 })
  await removeScore(parsed.data.game, parsed.data.name)
  return NextResponse.json({ success: true })
}
