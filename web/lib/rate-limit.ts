import "server-only";

/**
 * 단순 인메모리 IP rate limiter (Vercel serverless 인스턴스별 독립).
 * 고도 보호가 아닌 abuse 완화용. 프로덕션에선 Upstash/Redis로 교체 권장.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): {
  ok: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  const ok = bucket.count <= limit;
  return { ok, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function rateLimit(req: Request, routeKey: string, limit = 60, windowMs = 60_000) {
  const ip = getClientIp(req);
  const res = checkRateLimit({ key: `${routeKey}:${ip}`, limit, windowMs });
  if (!res.ok) {
    return new Response(JSON.stringify({ error: "too many requests" }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.ceil((res.resetAt - Date.now()) / 1000)),
      },
    });
  }
  return null;
}
