// Simple in-memory token bucket rate limiter
// Resets every 60 seconds. Fine for serverless — resets on cold start.

const buckets = new Map<string, { tokens: number; lastRefill: number }>();

const MAX_TOKENS = 5; // max requests per window
const REFILL_MS = 60_000; // 1 minute window

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.lastRefill > REFILL_MS) {
    // Refill
    buckets.set(ip, { tokens: MAX_TOKENS - 1, lastRefill: now });
    return true;
  }

  if (bucket.tokens <= 0) {
    return false;
  }

  bucket.tokens--;
  return true;
}
