/**
 * tests/api.test.ts
 *
 * Automated test suite for the IEEJAY EATS API.
 *
 * Run against the live deployed URL:
 *   API_BASE=https://your-url.railway.app npx tsx tests/api.test.ts
 *
 * Or against local dev server:
 *   API_BASE=http://localhost:3000 npx tsx tests/api.test.ts
 *
 * Tests cover:
 *  - Happy path (list, get, create, update, delete)
 *  - Missing resources (404)
 *  - Malformed IDs (400)
 *  - Bad query parameters (400)
 *  - Pagination correctness
 *  - Filtering
 *  - Sorting (valid and invalid)
 *  - Excessive limit (clamped, not 500)
 *  - Negative offset (400)
 *  - Missing required POST fields (422)
 *  - Rate limiting (429)
 */

const API_BASE = process.env.API_BASE ?? "http://localhost:3000";
const BASE = `${API_BASE}/api/v1`;

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function get(path: string): Promise<{ status: number; body: unknown; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers };
}

async function post(path: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function patch(path: string, data: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function del(path: string): Promise<{ status: number }> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE" });
  return { status: res.status };
}

// ─── State shared across tests ────────────────────────────────────────────────

let firstRestaurantId = "";
let firstMenuItemId = "";
let firstCustomerId = "";
let createdOrderId = "";

// ─── Test suites ──────────────────────────────────────────────────────────────

console.log(`\n🧪 IEEJAY EATS API Test Suite`);
console.log(`   Target: ${BASE}\n`);

async function runTests() {

  // ── Restaurants list ────────────────────────────────────────────────────────
  console.log("▶ Restaurants");

  await test("GET /restaurants returns 200 with data + meta", async () => {
    const { status, body } = await get("/restaurants");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(b.data), "data should be an array");
    assert(typeof b.meta === "object" && b.meta !== null, "meta should be an object");
    const meta = b.meta as Record<string, unknown>;
    assert(typeof meta.total === "number", "meta.total should be a number");
    assert(typeof meta.hasMore === "boolean", "meta.hasMore should be a boolean");
    const data = b.data as Record<string, unknown>[];
    assert(data.length > 0, "Expected at least one restaurant");
    firstRestaurantId = data[0].id as string;
  });

  await test("GET /restaurants?limit=5 returns at most 5 records", async () => {
    const { status, body } = await get("/restaurants?limit=5");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as unknown[];
    assert(data.length <= 5, `Expected ≤5 records, got ${data.length}`);
  });

  await test("GET /restaurants?limit=5000 is clamped to ≤100", async () => {
    const { status, body } = await get("/restaurants?limit=5000");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as unknown[];
    assert(data.length <= 100, `Expected ≤100 records, got ${data.length}`);
  });

  await test("GET /restaurants?offset=-1 returns 400", async () => {
    const { status } = await get("/restaurants?offset=-1");
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("GET /restaurants?sort=banana returns 400", async () => {
    const { status, body } = await get("/restaurants?sort=banana");
    const b = body as Record<string, unknown>;
    assert(status === 400, `Expected 400, got ${status}`);
    const err = b.error as Record<string, unknown>;
    assert(err?.code === "BAD_REQUEST", "Expected BAD_REQUEST code");
  });

  await test("GET /restaurants?city=Lagos filters by city", async () => {
    const { status, body } = await get("/restaurants?city=Lagos&limit=10");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    const allLagos = data.every((r) => (r.city as string).toLowerCase() === "lagos");
    assert(allLagos, "All results should be in Lagos");
  });

  await test("GET /restaurants?sort=rating&order=desc sorts correctly", async () => {
    const { status, body } = await get("/restaurants?sort=rating&order=desc&limit=10");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    const ratings = data.map((r) => r.rating as number);
    for (let i = 1; i < ratings.length; i++) {
      assert(ratings[i - 1] >= ratings[i], `Rating not sorted desc at index ${i}`);
    }
  });

  await test("GET /restaurants pagination: page 2 has different records", async () => {
    const r1 = await get("/restaurants?limit=5&offset=0");
    const r2 = await get("/restaurants?limit=5&offset=5");
    const ids1 = ((r1.body as Record<string, unknown>).data as Record<string, unknown>[]).map((r) => r.id);
    const ids2 = ((r2.body as Record<string, unknown>).data as Record<string, unknown>[]).map((r) => r.id);
    const overlap = ids1.filter((id) => ids2.includes(id));
    assert(overlap.length === 0, "Page 1 and page 2 should not share records");
  });

  // ── Single restaurant ────────────────────────────────────────────────────────
  console.log("\n▶ Single Restaurant");

  await test("GET /restaurants/:id returns the restaurant", async () => {
    const { status, body } = await get(`/restaurants/${firstRestaurantId}`);
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>;
    assert(data.id === firstRestaurantId, "ID mismatch");
  });

  await test("GET /restaurants/bad-id returns 400", async () => {
    const { status } = await get("/restaurants/not-a-uuid");
    assert(status === 400, `Expected 400, got ${status}`);
  });

  await test("GET /restaurants/non-existent-uuid returns 404", async () => {
    const { status, body } = await get("/restaurants/00000000-0000-4000-8000-000000000000");
    const b = body as Record<string, unknown>;
    assert(status === 404, `Expected 404, got ${status}`);
    const err = b.error as Record<string, unknown>;
    assert(err?.code === "NOT_FOUND", "Expected NOT_FOUND code");
  });

  // ── Restaurant menu ──────────────────────────────────────────────────────────
  console.log("\n▶ Restaurant Menu");

  await test("GET /restaurants/:id/menu returns menu items", async () => {
    const { status, body } = await get(`/restaurants/${firstRestaurantId}/menu`);
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(b.data), "data should be an array");
    const data = b.data as Record<string, unknown>[];
    if (data.length > 0) firstMenuItemId = data[0].id as string;
  });

  await test("GET /restaurants/:id/menu?sort=price&order=asc sorts by price", async () => {
    const { status, body } = await get(`/restaurants/${firstRestaurantId}/menu?sort=price&order=asc`);
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    const prices = data.map((r) => r.price as number);
    for (let i = 1; i < prices.length; i++) {
      assert(prices[i - 1] <= prices[i], `Price not sorted asc at index ${i}`);
    }
  });

  // ── Menu items ────────────────────────────────────────────────────────────────
  console.log("\n▶ Menu Items");

  await test("GET /menu-items returns list", async () => {
    const { status, body } = await get("/menu-items");
    assert(status === 200, `Expected 200, got ${status}`);
    const b = body as Record<string, unknown>;
    assert(Array.isArray(b.data), "data should be an array");
    if (!firstMenuItemId) {
      const data = b.data as Record<string, unknown>[];
      if (data.length > 0) firstMenuItemId = data[0].id as string;
    }
  });

  await test("GET /menu-items?category=Main filters by category", async () => {
    const { status, body } = await get("/menu-items?category=Main&limit=10");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    const allMain = data.every((r) => (r.category as string).toLowerCase() === "main");
    assert(allMain, "All results should have category Main");
  });

  await test("GET /menu-items?minPrice=2000&maxPrice=5000 filters by price", async () => {
    const { status, body } = await get("/menu-items?minPrice=2000&maxPrice=5000&limit=10");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    const inRange = data.every((r) => (r.price as number) >= 2000 && (r.price as number) <= 5000);
    assert(inRange, "All results should be within price range");
  });

  await test("GET /menu-items?minPrice=abc returns 400", async () => {
    const { status } = await get("/menu-items?minPrice=abc");
    assert(status === 400, `Expected 400, got ${status}`);
  });

  if (firstMenuItemId) {
    await test("GET /menu-items/:id returns item", async () => {
      const { status, body } = await get(`/menu-items/${firstMenuItemId}`);
      const b = body as Record<string, unknown>;
      assert(status === 200, `Expected 200, got ${status}`);
      const data = b.data as Record<string, unknown>;
      assert(data.id === firstMenuItemId, "ID mismatch");
    });
  }

  // ── Customers ─────────────────────────────────────────────────────────────────
  console.log("\n▶ Customers");

  await test("GET /customers returns list", async () => {
    const { status, body } = await get("/customers");
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>[];
    assert(data.length > 0, "Expected customers");
    firstCustomerId = data[0].id as string;
  });

  await test("GET /customers/:id returns customer", async () => {
    const { status, body } = await get(`/customers/${firstCustomerId}`);
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>;
    assert(data.id === firstCustomerId, "ID mismatch");
  });

  // ── Orders ────────────────────────────────────────────────────────────────────
  console.log("\n▶ Orders — Create / Read / Update / Delete");

  // Get a menu item for the restaurant
  let testMenuItemId = firstMenuItemId;
  if (!testMenuItemId) {
    const { body } = await get(`/restaurants/${firstRestaurantId}/menu?limit=1`);
    const b = body as Record<string, unknown>;
    const data = b.data as Record<string, unknown>[];
    testMenuItemId = data[0]?.id as string ?? "";
  }

  await test("POST /orders creates an order (201)", async () => {
    const { status, body } = await post("/orders", {
      customerId: firstCustomerId,
      restaurantId: firstRestaurantId,
      deliveryAddress: "12 Awolowo Road, Lagos",
      items: [{ menuItemId: testMenuItemId, quantity: 2 }],
    });
    const b = body as Record<string, unknown>;
    assert(status === 201, `Expected 201, got ${status}`);
    const data = b.data as Record<string, unknown>;
    assert(typeof data.id === "string", "Order should have an ID");
    assert(data.status === "pending", "New order should be pending");
    createdOrderId = data.id as string;
  });

  await test("GET /orders/:id returns the created order", async () => {
    const { status, body } = await get(`/orders/${createdOrderId}`);
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>;
    assert(data.id === createdOrderId, "ID mismatch");
  });

  await test("PATCH /orders/:id updates status to confirmed", async () => {
    const { status, body } = await patch(`/orders/${createdOrderId}`, { status: "confirmed" });
    const b = body as Record<string, unknown>;
    assert(status === 200, `Expected 200, got ${status}`);
    const data = b.data as Record<string, unknown>;
    assert(data.status === "confirmed", "Status should be confirmed");
  });

  await test("PATCH /orders/:id with invalid status returns 422", async () => {
    const { status } = await patch(`/orders/${createdOrderId}`, { status: "flying" });
    assert(status === 422, `Expected 422, got ${status}`);
  });

  await test("DELETE /orders/:id returns 204", async () => {
    const { status } = await del(`/orders/${createdOrderId}`);
    assert(status === 204, `Expected 204, got ${status}`);
  });

  await test("GET /orders/:id after delete returns 404", async () => {
    const { status } = await get(`/orders/${createdOrderId}`);
    assert(status === 404, `Expected 404, got ${status}`);
  });

  // ── Bad order inputs ──────────────────────────────────────────────────────────
  console.log("\n▶ Orders — Validation");

  await test("POST /orders with missing items returns 422", async () => {
    const { status, body } = await post("/orders", {
      customerId: firstCustomerId,
      restaurantId: firstRestaurantId,
      deliveryAddress: "12 Awolowo Road, Lagos",
    });
    const b = body as Record<string, unknown>;
    assert(status === 422, `Expected 422, got ${status}`);
    const err = b.error as Record<string, unknown>;
    assert(err?.code === "UNPROCESSABLE_ENTITY", "Expected UNPROCESSABLE_ENTITY");
  });

  await test("POST /orders with missing deliveryAddress returns 422", async () => {
    const { status } = await post("/orders", {
      customerId: firstCustomerId,
      restaurantId: firstRestaurantId,
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
    });
    assert(status === 422, `Expected 422, got ${status}`);
  });

  await test("POST /orders with non-existent customerId returns 404", async () => {
    const { status } = await post("/orders", {
      customerId: "00000000-0000-4000-8000-000000000001",
      restaurantId: firstRestaurantId,
      deliveryAddress: "12 Awolowo Road, Lagos",
      items: [{ menuItemId: testMenuItemId, quantity: 1 }],
    });
    assert(status === 404, `Expected 404, got ${status}`);
  });

  await test("POST /orders with invalid JSON returns 400", async () => {
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    assert(res.status === 400, `Expected 400, got ${res.status}`);
  });

  // ── Rate limit ────────────────────────────────────────────────────────────────
  console.log("\n▶ Rate Limiting (this will fire many requests)");

  await test("Sending 110 requests triggers HTTP 429", async () => {
    let got429 = false;
    // Fire 110 requests rapidly
    for (let i = 0; i < 110; i++) {
      const { status } = await get("/restaurants?limit=1");
      if (status === 429) { got429 = true; break; }
    }
    assert(got429, "Expected at least one 429 response after exceeding rate limit");
  });

  // ── Summary ───────────────────────────────────────────────────────────────────

  console.log(`\n─────────────────────────────────`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`─────────────────────────────────\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
