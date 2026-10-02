/**
 * app/api/v1/restaurants/route.ts
 *
 * GET /api/v1/restaurants
 *
 * Filters:  ?city=Lagos  ?cuisineType=Nigerian  ?isOpen=true
 * Sort:     ?sort=rating&order=desc   (allowed: name, rating, createdAt)
 * Paginate: ?limit=20&offset=0
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildMeta } from "@/lib/pagination";
import { parseSort } from "@/lib/sorting";
import { okCollection, err400 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";

const ALLOWED_SORT_FIELDS = ["name", "rating", "createdAt"] as const;

export async function GET(req: NextRequest) {
  // Rate limit
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const sp = req.nextUrl.searchParams;

  // Pagination
  const pageResult = parsePagination(sp);
  if (!pageResult.ok) return err400(pageResult.message);
  const { limit, offset } = pageResult.params;

  // Sorting
  const sortResult = parseSort(sp, ALLOWED_SORT_FIELDS, "createdAt", "desc");
  if (!sortResult.ok) return err400(sortResult.message);
  const { field, order } = sortResult.params;

  // Filters
  const city = sp.get("city") ?? undefined;
  const cuisineType = sp.get("cuisineType") ?? undefined;
  const isOpenRaw = sp.get("isOpen");
  let isOpen: boolean | undefined;
  if (isOpenRaw !== null) {
    if (isOpenRaw !== "true" && isOpenRaw !== "false") {
      return err400(`isOpen must be "true" or "false", got: ${isOpenRaw}`);
    }
    isOpen = isOpenRaw === "true";
  }

  const where = {
    ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
    ...(cuisineType ? { cuisineType: { equals: cuisineType, mode: "insensitive" as const } } : {}),
    ...(isOpen !== undefined ? { isOpen } : {}),
  };

  const [total, restaurants] = await Promise.all([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      orderBy: { [field]: order },
      take: limit,
      skip: offset,
    }),
  ]);

  return okCollection(restaurants, buildMeta(total, limit, offset));
}
