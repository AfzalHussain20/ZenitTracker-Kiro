/**
 * Tiny in-isolate rate limiter.
 *
 * Cloudflare Workers keeps a module instance warm per isolate, so this stops
 * accidental hammering and simple scripted abuse. It is not a substitute for
 * Cloudflare WAF/rate-limiting rules, but it is free and immediate.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function clientKey(req: Request): string {
  const headers = req.headers;
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Returns `true` when the caller is within the limit, `false` when throttled.
 */
export function checkRateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  if (now - lastSweep > 60_000) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    lastSweep = now;
  }

  const key = `${scope}:${clientKey(req)}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function rateLimitResponse(retryAfterSeconds = 60): Response {
  return new Response(JSON.stringify({ error: 'Too many requests. Please slow down.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
    },
  });
}
