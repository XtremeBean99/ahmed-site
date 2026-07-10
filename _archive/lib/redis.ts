import { Redis } from '@upstash/redis'

let client: Redis | null = null

/** Lazily construct the Upstash Redis client (build-safe, like resend.ts). */
export function getRedis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
    if (!url || !token) {
      throw new Error('Upstash Redis env vars are not set')
    }
    client = new Redis({ url, token })
  }
  return client
}
