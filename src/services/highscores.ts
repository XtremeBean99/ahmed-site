import { getRedis } from '@/lib/redis'
import { BOARD_SIZE, HISCORE_GAMES, hiscoreGame, type HiscoreEntry, type HiscoreGameId } from '@/lib/games/highscores'

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
