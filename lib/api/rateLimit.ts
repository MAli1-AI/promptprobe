/**
 * In-memory sliding-window rate limiter: at most RATE_LIMIT_MAX requests per
 * RATE_LIMIT_WINDOW_MS per client key. Best effort only: on serverless each warm
 * instance has its own counters, which is fine as a demo-grade abuse brake.
 */
export const RATE_LIMIT_MAX = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
const PRUNE_THRESHOLD = 5_000;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= RATE_LIMIT_MAX) {
    hits.set(key, recent);
    const retryAfterMs = recent[0] + RATE_LIMIT_WINDOW_MS - now;
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  if (hits.size > PRUNE_THRESHOLD) {
    for (const [k, times] of hits) {
      if (times.every((t) => t <= windowStart)) hits.delete(k);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Test helper. */
export function resetRateLimit(): void {
  hits.clear();
}

/** Client key from proxy headers (Vercel sets x-forwarded-for). Falls back to 'unknown'. */
export function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = req.headers.get('x-real-ip')?.trim();
  return real ? real.slice(0, 64) : 'unknown';
}
