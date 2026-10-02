/**
 * app/api/v1/customers/route.ts
 *
 * GET /api/v1/customers
 *
 * Filters:  ?city=Lagos  (matched against address substring)
 * Sort:     ?sort=createdAt&order=desc  (allowed: firstName, lastName, createdAt)
 * Paginate: ?limit=20&offset=0
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildMeta } from "@/lib/pagination";
import { parseSort } from "@/lib/sorting";
import { okCollection, err400 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";

const ALLOWED_SORT_FIELDS = ["firstName", "lastName", "createdAt"] as const;

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

  const city = sp.get("city") ?? undefined;

  const where = {
    ...(city
      ? { address: { contains: city, mode: "insensitive" as const } }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { [field]: order },
      take: limit,
      skip: offset,
    }),
  ]);

  return okCollection(customers, buildMeta(total, limit, offset));
}
