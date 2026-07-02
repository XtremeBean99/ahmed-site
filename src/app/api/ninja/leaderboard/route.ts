import { NextRequest, NextResponse } from 'next/server'
import { ninjaScoreSchema } from '@/lib/validations'
import { addScore, topScores, type LeaderboardEntry } from '@/services/leaderboard'
import { checkRateLimit } from '@/lib/ratelimit'

const ALLOWED_ORIGINS = new Set([
  'https://ahmedyhussain.com',
  'https://www.ahmedyhussain.com',
  ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
])

export async function GET(): Promise<NextResponse> {
  try {
    const [anyPercent, hundredPercent] = await Promise.all([
      topScores('any'),
      topScores('hundred'),
    ])
    return NextResponse.json({ anyPercent, hundredPercent })
  } catch {
    return NextResponse.json({ anyPercent: [], hundredPercent: [] }, { status: 200 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Origin: absent is fine (desktop game builds); present-but-foreign is not.
  const origin = req.headers.get('origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { allowed } = checkRateLimit(`ninja:${ip}`)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ninjaScoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
  }

  const entry: LeaderboardEntry = {
    name: parsed.data.name.trim(),
    timeCs: parsed.data.timeCs,
    at: Date.now(),
    tokensPercent: parsed.data.tokensPercent,
  }

  try {
    await addScore('any', entry)
    if (parsed.data.tokensPercent === 100) {
      await addScore('hundred', entry)
    }
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
