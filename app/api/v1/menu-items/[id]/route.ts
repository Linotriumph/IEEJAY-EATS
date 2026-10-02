/**
 * app/api/v1/menu-items/[id]/route.ts
 *
 * GET /api/v1/menu-items/:id
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
    return err400(`Invalid menu item ID format: ${id}`);
  }

  const item = await prisma.menuItem.findUnique({ where: { id } });

  if (!item) {
    return err404(`Menu item not found: ${id}`);
  }

  return okSingle(item);
}
