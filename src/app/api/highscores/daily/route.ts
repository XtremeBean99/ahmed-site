import { NextRequest, NextResponse } from 'next/server'
import { dailyScoreSchema } from '@/lib/validations'
import { listDailyBoard, submitDailyScore } from '@/services/highscores'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { isSameSiteRequest } from '@/lib/csrf'
import { BAD_WORDS, stripUnsafe } from '@/lib/input'
import { DAILY_GAMES, dailyDate, isAcceptedDailyDate, type DailyGameId } from '@/lib/games/daily'
import { isPlausibleScore } from '@/lib/games/highscores'

/**
 * The daily challenge's board: GET ?game=minesweeper[&date=YYYY-MM-DD] (today
 * by default), POST a time for today or yesterday (UTC). Same guards as
 * /api/highscores; the plausible range is the game's normal one.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const game = searchParams.get('game') as DailyGameId | null
  const date = searchParams.get('date') ?? dailyDate()
  if (!game || !(DAILY_GAMES as readonly string[]).includes(game) || !isAcceptedDailyDate(date))
    return NextResponse.json({ error: 'Unknown board.' }, { status: 400 })
  try { return NextResponse.json({ date, board: await listDailyBoard(game, date) }) }
  catch (e) { console.error('[daily] GET failed', e); return NextResponse.json({ date, board: null }) }
}

export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || 'ahmedyhussain.com'
  if (process.env.NODE_ENV === 'production') {
    const ok = isSameSiteRequest(request.headers.get('origin'), request.headers.get('referer'), host)
    if (!ok) return NextResponse.json({ success: true }) // silently reject cross-origin
  }
  const ip = getClientIp(request.headers)
  if (!(await checkRateLimit(`daily:${ip}`, 10)).allowed)
    return NextResponse.json({ error: 'Too many submissions. Try again later.' }, { status: 429 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body.' }, { status: 400 }) }
  const parsed = dailyScoreSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input.' }, { status: 400 })
  const { game, date, name, score, website } = parsed.data
  if (website && website.length > 0) return NextResponse.json({ success: true }) // honeypot
  if (!isAcceptedDailyDate(date)) return NextResponse.json({ error: "That day's board is closed." }, { status: 400 })
  if (!isPlausibleScore(game, score)) return NextResponse.json({ error: 'Score rejected.' }, { status: 400 })

  const cleanName = stripUnsafe(name)
  if (!cleanName || BAD_WORDS.test(cleanName)) return NextResponse.json({ error: 'Name rejected.' }, { status: 400 })
  try {
    const rank = await submitDailyScore(game, date, cleanName, score)
    return NextResponse.json({ success: true, rank })
  } catch (e) { console.error('[daily] POST failed', e); return NextResponse.json({ error: 'Could not save right now.' }, { status: 500 }) }
}
