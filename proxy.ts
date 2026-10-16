/**
 * proxy.ts
 *
 * Next.js Proxy — runs before every request.
 *
 * Responsibility: Add CORS headers to all /api/* responses so the
 * frontend (potentially on a different subdomain) can call the API.
 *
 * CORS is configured to allow any origin because this is a public,
 * unauthenticated API. If authentication were added, the allowed origin
 * list would need to be restricted.
 */
import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const response = NextResponse.next();

  // Allow any origin to call the public API
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");

  return response;
}

// Only run this proxy on API routes
export const config = {
  matcher: "/api/:path*",
};
