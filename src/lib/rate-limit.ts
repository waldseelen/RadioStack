type Bucket = { count: number; reset: number }
const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now > b.reset) {
    b = { count: 0, reset: now + windowMs }
    buckets.set(key, b)
  }
  if (b.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.reset - now) / 1000))
    return { ok: false, retryAfterSec }
  }
  b.count += 1
  return { ok: true }
}
