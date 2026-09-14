/**
 * Same-site check for state-changing requests. Origin wins when present; Referer is only a
 * fallback for clients that omit Origin. Both compare exact origins, never string prefixes,
 * so `https://example.com.evil.com` cannot pass for `https://example.com`.
 */
export function isSameSiteRequest(origin: string | null, referer: string | null, host: string): boolean {
  const allowed = new Set([`https://${host}`, `https://www.${host}`])
  const originOf = (value: string) => {
    try {
      return new URL(value).origin
    } catch {
      return null
    }
  }
  if (origin) return allowed.has(origin)
  if (referer) {
    const refererOrigin = originOf(referer)
    return refererOrigin !== null && allowed.has(refererOrigin)
  }
  return false
}
