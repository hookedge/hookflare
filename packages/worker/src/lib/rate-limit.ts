import type { Context, Next } from "hono";
import type { Env } from "./types";

/**
 * Simple sliding-window rate limiter using KV.
 *
 * Limits requests per source_id to prevent abuse of the public
 * ingress endpoint. Uses KV with TTL for automatic expiry.
 *
 * Default: 100 requests per 60 seconds per source.
 */
const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_SEC = 60;

export function rateLimitMiddleware(opts?: { limit?: number; windowSec?: number }) {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowSec = opts?.windowSec ?? DEFAULT_WINDOW_SEC;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const sourceId = c.req.param("source_id");
    if (!sourceId) {
      await next();
      return;
    }

    const key = `rl:${sourceId}:${Math.floor(Date.now() / (windowSec * 1000))}`;
    const current = parseInt((await c.env.IDEMPOTENCY_KV.get(key)) ?? "0", 10);

    if (current >= limit) {
      return c.json(
        {
          error: {
            message: `Rate limit exceeded: ${limit} requests per ${windowSec}s`,
            code: "RATE_LIMITED",
          },
        },
        429,
      );
    }

    await c.env.IDEMPOTENCY_KV.put(key, String(current + 1), {
      expirationTtl: windowSec * 2, // 2x window for safety
    });

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(limit - current - 1));

    await next();
  };
}
