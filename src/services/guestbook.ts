import { getRedis } from '@/lib/redis'

export interface GuestbookEntry { id: string; name: string; message: string; at: number }

const KEY = 'guestbook:entries'
const MAX_STORED = 500

export async function addEntry(input: { name: string; message: string }): Promise<GuestbookEntry> {
  const redis = getRedis()
  const entry: GuestbookEntry = { id: crypto.randomUUID(), name: input.name, message: input.message, at: Date.now() }
  const member = JSON.stringify(entry)
  await redis.zadd(KEY, { score: entry.at, member })
  const count = await redis.zcard(KEY)
  if (count > MAX_STORED) {
    await redis.zremrangebyrank(KEY, 0, count - MAX_STORED - 1)
  }
  return entry
}

// @upstash/redis auto-deserializes sorted-set members — they come back as objects, not strings.
// Do NOT JSON.parse the result; the SDK already did it.
export async function listEntries(limit = 50): Promise<GuestbookEntry[]> {
  const redis = getRedis()
  const raw = await redis.zrange<GuestbookEntry[]>(KEY, 0, limit - 1, { rev: true })
  return raw
}

export async function deleteEntry(id: string): Promise<void> {
  const redis = getRedis()
  const raw = await redis.zrange<GuestbookEntry[]>(KEY, 0, -1)
  for (const entry of raw) {
    if (entry.id === id) { await redis.zrem(KEY, JSON.stringify(entry)); return }
  }
}

/** Keep only the `keep` most-recent entries; return how many were removed. */
export async function trimEntries(keep: number): Promise<number> {
  const redis = getRedis()
  const count = await redis.zcard(KEY)
  if (count <= keep) return 0
  const removed = count - keep
  await redis.zremrangebyrank(KEY, 0, removed - 1)
  return removed
}
