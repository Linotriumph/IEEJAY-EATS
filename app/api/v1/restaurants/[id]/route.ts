/**
 * app/api/v1/restaurants/[id]/route.ts
 *
 * GET /api/v1/restaurants/:id
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { okSingle, err400, err404 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";
import { isValidUUID } from "@/lib/utils";

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

  const restaurant = await prisma.restaurant.findUnique({ where: { id } });

  if (!restaurant) {
    return err404(`Restaurant not found: ${id}`);
  }

  return okSingle(restaurant);
}
