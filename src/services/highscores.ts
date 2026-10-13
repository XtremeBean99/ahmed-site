import { getRedis } from '@/lib/redis'
import { BOARD_SIZE, HISCORE_GAMES, hiscoreGame, type HiscoreEntry, type HiscoreGameId } from '@/lib/games/highscores'
import type { DailyGameId } from '@/lib/games/daily'

/**
 * Public highscores: one Upstash sorted set per game, `hiscores:<game>`,
 * member = the player's name (prefixed, so the SDK never JSON-parses a name
 * like "123" into a number), score = their best. ZADD GT/LT keeps each name's
 * best only. The 100 best per game are kept; the boards show the top 10.
 * Names and scores only: no IP, no timestamps.
 */
const KEY = (game: string) => `hiscores:${game}`
const PREFIX = 'n:'
const KEEP = 100

/** Records `score` for `name` if it beats their stored best. Returns the name's 1-based rank. */
export async function submitScore(game: HiscoreGameId, name: string, score: number): Promise<number | null> {
  const redis = getRedis()
  const lower = hiscoreGame(game)!.lowerIsBetter
  const key = KEY(game)
  const member = PREFIX + name
  await redis.zadd(key, lower ? { lt: true } : { gt: true }, { score, member })
  const count = await redis.zcard(key)
  if (count > KEEP) {
    // Ranks run low score first: drop the worst end.
    if (lower) await redis.zremrangebyrank(key, KEEP, -1)
    else await redis.zremrangebyrank(key, 0, count - KEEP - 1)
  }
  const rank = lower ? await redis.zrank(key, member) : await redis.zrevrank(key, member)
  return rank === null ? null : rank + 1
}

/** Every game's top 10, best first. */
export async function listBoards(): Promise<Record<HiscoreGameId, HiscoreEntry[]>> {
  const redis = getRedis()
  const pipe = redis.pipeline()
  for (const g of HISCORE_GAMES) {
    pipe.zrange(KEY(g.id), 0, BOARD_SIZE - 1, g.lowerIsBetter ? { withScores: true } : { rev: true, withScores: true })
  }
  const results = (await pipe.exec()) as unknown[][]
  const boards = {} as Record<HiscoreGameId, HiscoreEntry[]>
  HISCORE_GAMES.forEach((g, i) => {
    const flat = results[i] ?? []
    const entries: HiscoreEntry[] = []
    for (let j = 0; j + 1 < flat.length; j += 2) {
      const member = String(flat[j])
      entries.push({ name: member.startsWith(PREFIX) ? member.slice(PREFIX.length) : member, score: Number(flat[j + 1]) })
    }
    boards[g.id] = entries
  })
  return boards
}

/** Admin: removes a name from one game's board. */
export async function removeScore(game: HiscoreGameId, name: string): Promise<void> {
  await getRedis().zrem(KEY(game), PREFIX + name)
}

/**
 * Daily boards: `hiscores:daily:<game>:<date>`, same member scheme, kept 8
 * days then left to expire. The daily games are all times, so lower is better.
 */
const DAILY_KEY = (game: string, date: string) => `hiscores:daily:${game}:${date}`
const DAILY_TTL_S = 8 * 86_400

/** Records a daily time for `name` (their best stands). Returns the 1-based rank. */
export async function submitDailyScore(game: DailyGameId, date: string, name: string, score: number): Promise<number | null> {
  const redis = getRedis()
  const key = DAILY_KEY(game, date)
  const member = PREFIX + name
  await redis.zadd(key, { lt: true }, { score, member })
  await redis.expire(key, DAILY_TTL_S)
  const count = await redis.zcard(key)
  if (count > KEEP) await redis.zremrangebyrank(key, KEEP, -1)
  const rank = await redis.zrank(key, member)
  return rank === null ? null : rank + 1
}

/** One day's top 10, fastest first. */
export async function listDailyBoard(game: DailyGameId, date: string): Promise<HiscoreEntry[]> {
  const flat = (await getRedis().zrange(DAILY_KEY(game, date), 0, BOARD_SIZE - 1, { withScores: true })) as unknown[]
  const entries: HiscoreEntry[] = []
  for (let j = 0; j + 1 < flat.length; j += 2) {
    const member = String(flat[j])
    entries.push({ name: member.startsWith(PREFIX) ? member.slice(PREFIX.length) : member, score: Number(flat[j + 1]) })
  }
  return entries
}
