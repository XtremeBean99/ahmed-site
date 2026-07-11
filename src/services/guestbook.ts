import { getRedis } from '@/lib/redis'

export interface GuestbookEntry { id: string; name: string; message: string; at: number }

const KEY = 'guestbook:entries'
const MAX_STORED = 500

export async function addEntry(input: { name: string; message: string }): Promise<GuestbookEntry> {
  const redis = getRedis()
  const entry: GuestbookEntry = { id: crypto.randomUUID(), name: input.name, message: input.message, at: Date.now() }
  const member = JSON.stringify(entry)
  const added = await redis.zadd(KEY, { score: entry.at, member })
  console.error('[guestbook] zadd returned:', added, 'key:', KEY, 'score:', entry.at)
  // Verify the write by reading the member back by score
  const rangeCheck = await redis.zrange<string[]>(KEY, 0, 0, { rev: true })
  console.error('[guestbook] zrange top-1 after write:', JSON.stringify(rangeCheck))
  const count = await redis.zcard(KEY)
  console.error('[guestbook] zcard after write:', count)
  if (count > MAX_STORED) {
    await redis.zremrangebyrank(KEY, 0, count - MAX_STORED - 1)
  }
  return entry
}

export async function listEntries(limit = 50): Promise<GuestbookEntry[]> {
  const redis = getRedis()
  const raw = await redis.zrange<string[]>(KEY, 0, limit - 1, { rev: true }) // newest first
  return raw.map((m) => JSON.parse(m) as GuestbookEntry)
}

export async function deleteEntry(id: string): Promise<void> {
  const redis = getRedis()
  const raw = await redis.zrange<string[]>(KEY, 0, -1)
  for (const member of raw) {
    if ((JSON.parse(member) as GuestbookEntry).id === id) { await redis.zrem(KEY, member); return }
  }
}
