import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rate limiting", () => {
  it("allows burst then blocks with retryAfter", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 5; i++) expect(rateLimit(key, 5, 60).allowed).toBe(true);
    const r = rateLimit(key, 5, 60);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });
});
