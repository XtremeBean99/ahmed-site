import { getRedis } from '@/lib/redis'

export interface GuestbookEntry { id: string; name: string; message: string; at: number }

const KEY = 'guestbook:entries'
const MAX_STORED = 500

export async function addEntry(input: { name: string; message: string }): Promise<GuestbookEntry> {
  const redis = getRedis()
  const entry: GuestbookEntry = { id: crypto.randomUUID(), name: input.name, message: input.message, at: Date.now() }
  await redis.zadd(KEY, { score: entry.at, member: JSON.stringify(entry) })
  await redis.zremrangebyrank(KEY, 0, -(MAX_STORED + 1)) // drop oldest beyond the cap
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
