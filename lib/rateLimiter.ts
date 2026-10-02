/**
 * lib/rateLimiter.ts
 *
 * IP-based rate limiting for the public unauthenticated API.
 *
 * Implementation: In-memory sliding-window counter per IP.
 *
 * Why in-memory?
 * ──────────────
 * For a single-server deployment this is sufficient and requires no extra
 * infrastructure. The tradeoff is that limits are not shared across multiple
 * server instances. If the API is deployed across multiple replicas a Redis
 * adapter would be required.
 *
 * Configuration lives in lib/config.ts, NOT here.
 * That keeps all tuneable values in one discoverable place.
 *
 * When the limit is exceeded the response includes:
 *   HTTP 429 Too Many Requests
 *   Retry-After: <seconds until window resets>
 */
import { NextRequest, NextResponse } from "next/server";
import { config } from "./config";
import { err429 } from "./envelope";

interface WindowEntry {
  count: number;
  windowStart: number;
}

// Store is per-process; intentionally not persisted across restarts.
const store = new Map<string, WindowEntry>();

/**
 * Extract the real client IP from the request.
 * Respects the X-Forwarded-For header set by Railway / Vercel proxies.
 */
function getClientIP(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns { ok: true } if the request is within limits.
 * Returns { ok: false, response } with a 429 response if over limit.
 */
export function checkRateLimit(
  req: NextRequest
): { ok: true } | { ok: false; response: NextResponse } {
  const ip = getClientIP(req);
  const now = Date.now();
  const { windowMs, max } = config.rateLimit;

  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    store.set(ip, { count: 1, windowStart: now });
    return { ok: true };
  }

  entry.count += 1;

  if (entry.count > max) {
    const windowEndsAt = entry.windowStart + windowMs;
    const retryAfterSeconds = Math.ceil((windowEndsAt - now) / 1000);
    return { ok: false, response: err429(retryAfterSeconds) };
  }

  return { ok: true };
}
