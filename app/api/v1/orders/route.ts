/**
 * app/api/v1/orders/route.ts
 *
 * POST /api/v1/orders   — Create a new order
 * GET  /api/v1/orders   — List orders (with filters/sort/pagination)
 *
 * POST body (JSON):
 * {
 *   "customerId": "uuid",
 *   "restaurantId": "uuid",
 *   "deliveryAddress": "string",
 *   "items": [
 *     { "menuItemId": "uuid", "quantity": 1 }
 *   ]
 * }
 *
 * GET filters: ?status=pending  ?customerId=uuid  ?restaurantId=uuid
 * GET sort:    ?sort=createdAt&order=desc  (allowed: totalAmount, createdAt)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parsePagination, buildMeta } from "@/lib/pagination";
import { parseSort } from "@/lib/sorting";
import { okCollection, okSingle, err400, err404, err422 } from "@/lib/envelope";
import { checkRateLimit } from "@/lib/rateLimiter";
import { isValidUUID } from "@/lib/utils";

// ─── Validation schema (Zod) ──────────────────────────────────────────────────
// Centralising validation here means the rules are visible in one place and
// the handler stays clean.

const OrderItemSchema = z.object({
  menuItemId: z.string().uuid({ message: "menuItemId must be a valid UUID" }),
  quantity: z
    .number({ invalid_type_error: "quantity must be a number" })
    .int({ message: "quantity must be an integer" })
    .min(1, { message: "quantity must be at least 1" }),
});

const CreateOrderSchema = z.object({
  customerId: z.string().uuid({ message: "customerId must be a valid UUID" }),
  restaurantId: z.string().uuid({ message: "restaurantId must be a valid UUID" }),
  deliveryAddress: z
    .string({ required_error: "deliveryAddress is required" })
    .min(5, { message: "deliveryAddress must be at least 5 characters" }),
  items: z
    .array(OrderItemSchema, { required_error: "items is required" })
    .min(1, { message: "Order must contain at least one item" }),
});

const VALID_STATUSES = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"] as const;
const ALLOWED_SORT_FIELDS = ["totalAmount", "createdAt"] as const;

// ─── GET /api/v1/orders ───────────────────────────────────────────────────────

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

  const statusRaw = sp.get("status") ?? undefined;
  const customerIdRaw = sp.get("customerId") ?? undefined;
  const restaurantIdRaw = sp.get("restaurantId") ?? undefined;

  if (statusRaw && !VALID_STATUSES.includes(statusRaw as typeof VALID_STATUSES[number])) {
    return err400(`status must be one of: ${VALID_STATUSES.join(", ")}`);
  }
  if (customerIdRaw && !isValidUUID(customerIdRaw)) {
    return err400(`customerId filter must be a valid UUID`);
  }
  if (restaurantIdRaw && !isValidUUID(restaurantIdRaw)) {
    return err400(`restaurantId filter must be a valid UUID`);
  }

  const where = {
    ...(statusRaw ? { status: statusRaw as typeof VALID_STATUSES[number] } : {}),
    ...(customerIdRaw ? { customerId: customerIdRaw } : {}),
    ...(restaurantIdRaw ? { restaurantId: restaurantIdRaw } : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { [field]: order },
      take: limit,
      skip: offset,
      include: { items: true },
    }),
  ]);

  return okCollection(orders, buildMeta(total, limit, offset));
}

// ─── POST /api/v1/orders ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req);
  if (!rl.ok) return rl.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err400("Request body must be valid JSON");
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return err422(message);
  }

  const { customerId, restaurantId, deliveryAddress, items } = parsed.data;

  // Verify customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) return err404(`Customer not found: ${customerId}`);

  // Verify restaurant exists
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { id: true } });
  if (!restaurant) return err404(`Restaurant not found: ${restaurantId}`);

  // Verify all menu items exist and belong to this restaurant
  const menuItemIds = items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId },
    select: { id: true, price: true, name: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    const foundIds = new Set(menuItems.map((m) => m.id));
    const missing = menuItemIds.filter((id) => !foundIds.has(id));
    return err422(`The following menu item IDs were not found in restaurant ${restaurantId}: ${missing.join(", ")}`);
  }

  // Compute total
  const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));
  const totalAmount = items.reduce(
    (sum, item) => sum + (priceMap.get(item.menuItemId) ?? 0) * item.quantity,
    0
  );

  // Create order + order items in a transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        customerId,
        restaurantId,
        deliveryAddress,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        status: "pending",
      },
    });

    await tx.orderItem.createMany({
      data: items.map((item) => ({
        orderId: newOrder.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: priceMap.get(item.menuItemId)!,
      })),
    });

    return tx.order.findUnique({
      where: { id: newOrder.id },
      include: { items: true },
    });
  });

  return okSingle(order, 201);
}
