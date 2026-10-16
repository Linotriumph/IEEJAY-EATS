/**
 * lib/config.ts
 *
 * Single source of truth for all runtime configuration.
 * Values come from environment variables so they can be changed
 * per-environment without touching code.
 *
 * Why here and not inside handlers?
 * ---------------------------------
 * Hard-coding limits inside individual route handlers creates hidden
 * "magic numbers" scattered across the codebase. Keeping them in one
 * file means a reviewer or operator can find, audit, and change every
 * tuneable value in 30 seconds.
 */

function intEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) throw new Error(`Environment variable ${key} must be an integer, got: ${raw}`);
  return parsed;
}

export const config = {
  /** Pagination defaults – safe maximums enforced by all list handlers */
  pagination: {
    defaultLimit: intEnv("PAGINATION_DEFAULT_LIMIT", 20),
    maxLimit: intEnv("PAGINATION_MAX_LIMIT", 100),
  },

  /**
   * Rate limiting
   * windowMs: sliding window in milliseconds
   * max:      maximum requests per window per IP
   *
   * Configuration lives here (not in the middleware file) so an operator
   * can change limits by setting env vars and redeploying, without editing
   * any source files.
   */
  rateLimit: {
    windowMs: intEnv("RATE_LIMIT_WINDOW_MS", 60_000), // 1 minute
    max: intEnv("RATE_LIMIT_MAX", 100),               // 100 req / min / IP
  },

  nodeEnv: process.env.NODE_ENV ?? "development",
};
