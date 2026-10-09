import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Shared hostile-input helpers for the API routes that accept visitor text
 * (guestbook, highscores, feature requests).
 */

// Drop ASCII control characters (codes 0-31 and DEL 127) and any HTML tags; keep normal text.
export const stripUnsafe = (s: string) =>
  Array.from(s)
    .filter((ch) => { const c = ch.charCodeAt(0); return c > 31 && c !== 127 })
    .join('')
    .replace(/<[^>]*>/g, '')
    .trim()

export const BAD_WORDS = /\b(fuck|shit|cunt|nigg|faggot)\b/i // minimal; expand as needed

/**
 * Constant-time secret comparison. Both sides are hashed first so the compare
 * is over fixed-length buffers and the secret's length does not leak.
 */
export function secretMatches(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/** Admin key from `Authorization: Bearer <key>` or `X-Admin-Key`. Never a query param. */
export function adminKeyFrom(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
  return headers.get('x-admin-key')?.trim() || null
}
