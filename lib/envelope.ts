/**
 * lib/envelope.ts
 *
 * All API responses use one of two shapes:
 *
 *   Success (collection):  { data: [...], meta: { total, limit, offset, hasMore } }
 *   Success (single):      { data: {} }
 *   Error:                 { error: { code, message } }
 *
 * Keeping these in one file ensures every endpoint speaks the same language.
 */
import { NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface CollectionEnvelope<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SingleEnvelope<T> {
  data: T;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function okCollection<T>(
  items: T[],
  meta: PaginationMeta,
  status = 200
): NextResponse<CollectionEnvelope<T>> {
  return NextResponse.json({ data: items, meta }, { status });
}

export function okSingle<T>(
  item: T,
  status = 200
): NextResponse<SingleEnvelope<T>> {
  return NextResponse.json({ data: item }, { status });
}

export function errResponse(
  code: string,
  message: string,
  status: number
): NextResponse<ErrorEnvelope> {
  return NextResponse.json({ error: { code, message } }, { status });
}

// ─── Common error shortcuts ───────────────────────────────────────────────────

export const err400 = (message: string) => errResponse("BAD_REQUEST", message, 400);
export const err404 = (message: string) => errResponse("NOT_FOUND", message, 404);
export const err422 = (message: string) => errResponse("UNPROCESSABLE_ENTITY", message, 422);
export const err429 = (retryAfterSeconds: number) =>
  NextResponse.json(
    { error: { code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Please slow down." } },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
export const err500 = (message = "Internal server error") =>
  errResponse("INTERNAL_SERVER_ERROR", message, 500);
