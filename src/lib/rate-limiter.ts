// Simple in-memory token bucket rate limiter
// Resets every 60 seconds. Fine for serverless — resets on cold start.

const buckets = new Map<string, { tokens: number; lastRefill: number }>();

const DEFAULT_MAX_TOKENS = 5; // max requests per window
const REFILL_MS = 60_000; // 1 minute window

/**
 * Check if a request should be allowed under the rate limit.
 *
 * @param ip     — client IP address
 * @param limit  — max requests per window (default 5)
 * @param prefix — namespace to isolate different routes (e.g. "login", "contact")
 */
export function checkRateLimit(
  ip: string,
  limit = DEFAULT_MAX_TOKENS,
  prefix = "default"
): boolean {
  const key = `${prefix}:${ip}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.lastRefill > REFILL_MS) {
    // Refill
    buckets.set(key, { tokens: limit - 1, lastRefill: now });
    return true;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens--;
  return true;
}
