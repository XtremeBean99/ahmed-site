/**
 * Ninja leaderboard API.
 *
 * TRUST MODEL: Scores are client-trusted. The game client submits
 * {name, timeCs, tokensPercent} and the server only validates range/format,
 * not proof-of-play. Anyone can fabricate a run with a curl request.
 * This is a cosmetic game leaderboard with no privileges or money attached —
 * the board is for fun, not an authoritative record.
 *
 * If authenticity is ever needed: sign runs with a server-issued HMAC over
 * gameplay events, or validate plausibility server-side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ninjaScoreSchema } from '@/lib/validations'
import { addScore, topScores, type LeaderboardEntry } from '@/services/leaderboard'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'

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

  const ip = getClientIp(req.headers)
  const { allowed } = await checkRateLimit(`ninja:${ip}`)
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
