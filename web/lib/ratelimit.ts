// Minimal in-memory rate limiter for sensitive endpoints (no Redis per constraints).
// Per-key sliding window; returns {allowed, retryAfterSec}.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max = 20, windowSec = 60): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowSec * 1000);
  if (arr.length >= max) {
    const retryAfterSec = Math.ceil((arr[0]! + windowSec * 1000 - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  arr.push(now);
  hits.set(key, arr);
  return { allowed: true, retryAfterSec: 0 };
}
export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
