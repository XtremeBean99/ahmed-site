import { getRedis } from '@/lib/redis'

export type LeaderboardEntry = { name: string; timeCs: number; at: number }
export type Board = 'any' | 'hundred'

const KEYS: Record<Board, string> = {
  any: 'ninja:lb:any',
  hundred: 'ninja:lb:100',
}
const MAX_STORED = 100

/** Store a run. Sorted set scored by timeCs, so reads are pre-sorted. */
export async function addScore(board: Board, entry: LeaderboardEntry): Promise<void> {
  const redis = getRedis()
  const key = KEYS[board]
  await redis.zadd(key, { score: entry.timeCs, member: JSON.stringify(entry) })
  await redis.zremrangebyrank(key, MAX_STORED, -1)
}

/** Fastest runs first. */
export async function topScores(board: Board, limit = 20): Promise<LeaderboardEntry[]> {
  const redis = getRedis()
  const raw = await redis.zrange<(LeaderboardEntry | string)[]>(KEYS[board], 0, limit - 1)
  return raw.map((m) => (typeof m === 'string' ? (JSON.parse(m) as LeaderboardEntry) : m))
}
