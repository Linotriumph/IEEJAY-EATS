/**
 * app/api/v1/restaurants/[id]/menu/route.ts
 *
 * GET /api/v1/restaurants/:id/menu
 *
 * Returns menu items for a specific restaurant.
 * Filters:  ?category=Main  ?isAvailable=true
 * Sort:     ?sort=price&order=asc  (allowed: name, price, category, createdAt)
 * Paginate: ?limit=20&offset=0
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildMeta } from "@/lib/pagination";
import { parseSort } from "@/lib/sorting";
import { okCollection, err400, err404 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";
import { isValidUUID } from "@/lib/utils";

const ALLOWED_SORT_FIELDS = ["name", "price", "category", "createdAt"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const { id } = await params;

  if (!isValidUUID(id)) {
    return err400(`Invalid restaurant ID format: ${id}`);
  }

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!restaurant) {
    return err404(`Restaurant not found: ${id}`);
  }

  const sp = req.nextUrl.searchParams;

  const pageResult = parsePagination(sp);
  if (!pageResult.ok) return err400(pageResult.message);
  const { limit, offset } = pageResult.params;

  const sortResult = parseSort(sp, ALLOWED_SORT_FIELDS, "createdAt", "desc");
  if (!sortResult.ok) return err400(sortResult.message);
  const { field, order } = sortResult.params;

  const category = sp.get("category") ?? undefined;
  const isAvailableRaw = sp.get("isAvailable");
  let isAvailable: boolean | undefined;
  if (isAvailableRaw !== null) {
    if (isAvailableRaw !== "true" && isAvailableRaw !== "false") {
      return err400(`isAvailable must be "true" or "false", got: ${isAvailableRaw}`);
    }
    isAvailable = isAvailableRaw === "true";
  }

  const where = {
    restaurantId: id,
    ...(category ? { category: { equals: category, mode: "insensitive" as const } } : {}),
    ...(isAvailable !== undefined ? { isAvailable } : {}),
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
