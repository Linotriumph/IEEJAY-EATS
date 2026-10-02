/**
 * app/api/v1/orders/[id]/route.ts
 *
 * GET    /api/v1/orders/:id   — retrieve an order
 * PATCH  /api/v1/orders/:id   — update order status
 * DELETE /api/v1/orders/:id   — cancel/delete an order
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { okSingle, err400, err404, err422 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";
import { isValidUUID } from "@/lib/utils";

const VALID_STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;

const PatchOrderSchema = z.object({
  status: z.enum(VALID_STATUSES, {
    errorMap: () => ({ message: `status must be one of: ${VALID_STATUSES.join(", ")}` }),
  }),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const { id } = await params;
  if (!isValidUUID(id)) return err400(`Invalid order ID format: ${id}`);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!order) return err404(`Order not found: ${id}`);

  return okSingle(order);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const { id } = await params;
  if (!isValidUUID(id)) return err400(`Invalid order ID format: ${id}`);

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return err404(`Order not found: ${id}`);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err400("Request body must be valid JSON");
  }

  const parsed = PatchOrderSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return err422(message);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status: parsed.data.status },
    include: { items: true },
  });

  return okSingle(updated);
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  const { id } = await params;
  if (!isValidUUID(id)) return err400(`Invalid order ID format: ${id}`);

  const existing = await prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return err404(`Order not found: ${id}`);

  await prisma.order.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
