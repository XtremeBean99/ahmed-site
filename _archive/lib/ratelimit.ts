import { getRedis } from '@/lib/redis'

/**
 * Fixed-window rate limiter: 5 requests per hour per key.
 *
 * Primary store is Upstash Redis (INCR + EXPIRE), so limits survive
 * serverless cold starts and apply across concurrent instances. When the
 * Redis env vars are absent (local dev) or Redis errors, we fall back to
 * the old in-memory Map — best-effort limiting rather than a broken form.
 */
const WINDOW_S = 60 * 60
const WINDOW_MS = WINDOW_S * 1000
const MAX_REQUESTS = 5

interface Entry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, Entry>()

// Clean up expired in-memory entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (now > entry.resetAt) memoryStore.delete(key)
  }
}, 5 * 60 * 1000).unref?.()

function checkMemory(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}

export async function checkRateLimit(
  key: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (url && token) {
    try {
      const redis = getRedis()
      const redisKey = `rl:${key}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.expire(redisKey, WINDOW_S)
      return {
        allowed: count <= MAX_REQUESTS,
        remaining: Math.max(0, MAX_REQUESTS - count),
      }
    } catch {
      // Redis outage — degrade to per-instance limiting rather than 500ing
    }
  }
  return checkMemory(key)
}

/**
 * Client IP for rate-limit keys. The LEFTMOST X-Forwarded-For hop is
 * client-supplied and spoofable; prefer Vercel's x-real-ip, then the
 * rightmost XFF hop (appended by the platform).
 */
export function getClientIp(headers: Headers): string {
  const real = headers.get('x-real-ip')
  if (real) return real.trim()
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean)
    if (hops.length > 0) return hops[hops.length - 1]
  }
  return 'unknown'
}
