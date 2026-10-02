/**
 * app/api/v1/menu-items/route.ts
 *
 * GET /api/v1/menu-items
 *
 * Filters:  ?category=Main  ?minPrice=2000  ?maxPrice=8000  ?isAvailable=true
 * Sort:     ?sort=price&order=asc  (allowed: name, price, category, createdAt)
 * Paginate: ?limit=20&offset=0
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildMeta } from "@/lib/pagination";
import { parseSort } from "@/lib/sorting";
import { okCollection, err400 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";

const ALLOWED_SORT_FIELDS = ["name", "price", "category", "createdAt"] as const;

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const sp = req.nextUrl.searchParams;

  const pageResult = parsePagination(sp);
  if (!pageResult.ok) return err400(pageResult.message);
  const { limit, offset } = pageResult.params;

  const sortResult = parseSort(sp, ALLOWED_SORT_FIELDS, "createdAt", "desc");
  if (!sortResult.ok) return err400(sortResult.message);
  const { field, order } = sortResult.params;

  const category = sp.get("category") ?? undefined;
  const isAvailableRaw = sp.get("isAvailable");
  const rawMin = sp.get("minPrice");
  const rawMax = sp.get("maxPrice");

  let isAvailable: boolean | undefined;
  if (isAvailableRaw !== null) {
    if (isAvailableRaw !== "true" && isAvailableRaw !== "false") {
      return err400(`isAvailable must be "true" or "false", got: ${isAvailableRaw}`);
    }
    isAvailable = isAvailableRaw === "true";
  }

  let minPrice: number | undefined;
  if (rawMin !== null) {
    const v = parseFloat(rawMin);
    if (isNaN(v) || v < 0) return err400(`minPrice must be a non-negative number, got: ${rawMin}`);
    minPrice = v;
  }

  let maxPrice: number | undefined;
  if (rawMax !== null) {
    const v = parseFloat(rawMax);
    if (isNaN(v) || v < 0) return err400(`maxPrice must be a non-negative number, got: ${rawMax}`);
    maxPrice = v;
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return err400("minPrice must be less than or equal to maxPrice");
  }

  const where = {
    ...(category ? { category: { equals: category, mode: "insensitive" as const } } : {}),
    ...(isAvailable !== undefined ? { isAvailable } : {}),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { price: { ...(minPrice !== undefined ? { gte: minPrice } : {}), ...(maxPrice !== undefined ? { lte: maxPrice } : {}) } }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.menuItem.count({ where }),
    prisma.menuItem.findMany({
      where,
      orderBy: { [field]: order },
      take: limit,
      skip: offset,
    }),
  ]);

  return okCollection(items, buildMeta(total, limit, offset));
}
