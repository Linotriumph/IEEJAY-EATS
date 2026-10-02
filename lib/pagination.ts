/**
 * lib/pagination.ts
 *
 * Parses and validates ?limit=N&offset=M query parameters.
 * Returns a typed result so callers never have to guess whether
 * the values are valid numbers.
 *
 * Design:
 *  - Default limit comes from config.
 *  - limit is capped at config.pagination.maxLimit (never 5000+).
 *  - Negative offset returns a 400 error description for the caller to use.
 */
import { config } from "./config";

export interface PaginationParams {
  limit: number;
  offset: number;
}

export type PaginationResult =
  | { ok: true; params: PaginationParams }
  | { ok: false; message: string };

export function parsePagination(searchParams: URLSearchParams): PaginationResult {
  const rawLimit = searchParams.get("limit");
  const rawOffset = searchParams.get("offset");

  // ── limit ──
  let limit = config.pagination.defaultLimit;
  if (rawLimit !== null) {
    const parsed = parseInt(rawLimit, 10);
    if (isNaN(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, message: `limit must be a positive integer, got: ${rawLimit}` };
    }
    if (parsed <= 0) {
      return { ok: false, message: "limit must be greater than 0" };
    }
    // Silently clamp to max (spec says "do not return 5000 records")
    limit = Math.min(parsed, config.pagination.maxLimit);
  }

  // ── offset ──
  let offset = 0;
  if (rawOffset !== null) {
    const parsed = parseInt(rawOffset, 10);
    if (isNaN(parsed) || !Number.isInteger(parsed)) {
      return { ok: false, message: `offset must be a non-negative integer, got: ${rawOffset}` };
    }
    if (parsed < 0) {
      return { ok: false, message: "offset must be 0 or greater" };
    }
    offset = parsed;
  }

  return { ok: true, params: { limit, offset } };
}

/**
 * Build the meta block for every paginated response.
 */
export function buildMeta(total: number, limit: number, offset: number) {
  return {
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}
