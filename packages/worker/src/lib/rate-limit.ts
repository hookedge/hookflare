import type { Context, Next } from "hono";
import type { Env } from "./types";

/**
 * In-memory sliding window rate limiter.
 *
 * Uses per-isolate memory — zero KV reads/writes on the hot path.
 * Each Cloudflare edge location runs its own isolate, so limits are
 * per-edge-location, not global. This is intentional:
 * - No external I/O on the ingress critical path
 * - No KV quota consumption
 * - No eventual-consistency race conditions
 *
 * For strict global rate limiting, use Cloudflare WAF rules.
 *
 * Default: 100 requests per 60 seconds per source.
 */
const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;

// Per-isolate rate limit state
const counters = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries periodically
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}

export function rateLimitMiddleware(opts?: { limit?: number; windowMs?: number }) {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const sourceId = c.req.param("source_id");
    if (!sourceId) {
      await next();
      return;
    }

    cleanup();

    const now = Date.now();
    const key = `rl:${sourceId}`;
    let entry = counters.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      counters.set(key, entry);
    }

    entry.count++;

    if (entry.count > limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json(
        {
          error: {
            message: `Rate limit exceeded: ${limit} requests per ${windowMs / 1000}s`,
            code: "RATE_LIMITED",
          },
        },
        429,
      );
    }

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(limit - entry.count));

    await next();
  };
}
