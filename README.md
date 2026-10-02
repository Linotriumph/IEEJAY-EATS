# IEEJAY EATS API

A publicly consumable REST API for **IEEJAY EATS**, a Nigerian restaurant business. Built with Next.js, TypeScript, Prisma, and PostgreSQL. Deployed on Railway.

---

## Live URLs

| Resource | URL |
|---|---|
| **API base** | `https://YOUR_APP.up.railway.app/api/v1` |
| **Frontend consumer** | `https://YOUR_APP.up.railway.app` |

> Replace `YOUR_APP` with the actual Railway subdomain after deployment.

---

## Quick Start

```bash
# Clone
git clone <repo-url>
cd ieejay-eats

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL

# Push schema to database
npx prisma db push

# Seed the database
npm run seed

# Run dev server
npm run dev
```

---

## Resource Model

### Relationships

```
Restaurant  1 ──< MenuItem     (a restaurant has many menu items)
Restaurant  1 ──< Order        (a restaurant fulfils many orders)
Customer    1 ──< Order        (a customer places many orders)
Order       1 ──< OrderItem    (an order contains many line items)
OrderItem  >── 1 MenuItem      (each line item references a menu item)
```

### Restaurant

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | string | Restaurant name |
| description | string | Description |
| address | string | Street address |
| city | string | Nigerian city |
| phone | string | Phone number |
| cuisineType | string | Cuisine category |
| rating | float | Average rating (0–5) |
| isOpen | boolean | Whether currently open |
| createdAt | datetime | Record creation timestamp |

### MenuItem

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| restaurantId | UUID | Foreign key → Restaurant |
| name | string | Dish name |
| description | string | Dish description |
| category | string | Menu category |
| price | float | Price in Nigerian Naira (₦) |
| isAvailable | boolean | Whether item is available |
| createdAt | datetime | Record creation timestamp |

### Customer

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| firstName | string | First name |
| lastName | string | Last name |
| email | string | Email address (unique) |
| phone | string | Phone number |
| address | string | Delivery address |
| createdAt | datetime | Record creation timestamp |

### Order

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| customerId | UUID | Foreign key → Customer |
| restaurantId | UUID | Foreign key → Restaurant |
| status | enum | `pending` \| `confirmed` \| `preparing` \| `out_for_delivery` \| `delivered` \| `cancelled` |
| totalAmount | float | Total in Nigerian Naira (₦) |
| deliveryAddress | string | Delivery address |
| createdAt | datetime | Record creation timestamp |

### OrderItem

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| orderId | UUID | Foreign key → Order |
| menuItemId | UUID | Foreign key → MenuItem |
| quantity | integer | Number of units |
| unitPrice | float | Price snapshot at time of order |

---

## Response Envelopes

### Collection response

```json
{
  "data": [ ... ],
  "meta": {
    "total": 300,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

### Single resource response

```json
{
  "data": { ... }
}
```

### Error response

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Restaurant not found: <id>"
  }
}
```

---

## API Reference

### Base URL

```
/api/v1
```

---

### GET /api/v1/restaurants

List all restaurants with pagination, filtering, and sorting.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Records per page (max 100) |
| `offset` | integer | 0 | Skip this many records |
| `sort` | string | `createdAt` | Sort field: `name`, `rating`, `createdAt` |
| `order` | string | `desc` | Sort direction: `asc`, `desc` |
| `city` | string | — | Filter by city (case-insensitive) |
| `cuisineType` | string | — | Filter by cuisine type (case-insensitive) |
| `isOpen` | boolean | — | Filter by open status: `true`, `false` |

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/restaurants?city=Lagos&sort=rating&order=desc&limit=5"
```

**Response**

```json
{
  "data": [
    {
      "id": "3f8c9b2a-...",
      "name": "Mama Chukwu Kitchen",
      "description": "A warm family restaurant...",
      "address": "45 Awolowo Road",
      "city": "Lagos",
      "phone": "08031234567",
      "cuisineType": "Nigerian",
      "rating": 4.8,
      "isOpen": true,
      "createdAt": "2024-01-15T10:23:00.000Z"
    }
  ],
  "meta": {
    "total": 87,
    "limit": 5,
    "offset": 0,
    "hasMore": true
  }
}
```

**Errors**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid sort field, negative offset, invalid isOpen value |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |

---

### GET /api/v1/restaurants/:id

Retrieve a single restaurant.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | Restaurant ID |

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/restaurants/3f8c9b2a-1234-4abc-8def-000000000001"
```

**Errors**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_REQUEST` | ID is not a valid UUID |
| 404 | `NOT_FOUND` | Restaurant does not exist |

---

### GET /api/v1/restaurants/:id/menu

List menu items for a specific restaurant.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Records per page (max 100) |
| `offset` | integer | 0 | Skip this many records |
| `sort` | string | `createdAt` | Sort field: `name`, `price`, `category`, `createdAt` |
| `order` | string | `desc` | Sort direction: `asc`, `desc` |
| `category` | string | — | Filter by category (case-insensitive) |
| `isAvailable` | boolean | — | Filter by availability: `true`, `false` |

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/restaurants/3f8c9b2a-.../menu?category=Soups&sort=price&order=asc"
```

---

### GET /api/v1/menu-items

List all menu items across all restaurants.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Records per page (max 100) |
| `offset` | integer | 0 | Skip this many records |
| `sort` | string | `createdAt` | Sort field: `name`, `price`, `category`, `createdAt` |
| `order` | string | `desc` | Sort direction: `asc`, `desc` |
| `category` | string | — | Filter by category |
| `minPrice` | number | — | Minimum price (₦) |
| `maxPrice` | number | — | Maximum price (₦) |
| `isAvailable` | boolean | — | Filter by availability |

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/menu-items?category=Main&minPrice=2000&maxPrice=5000&sort=price&order=asc"
```

---

### GET /api/v1/menu-items/:id

Retrieve a single menu item.

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/menu-items/abc123..."
```

---

### GET /api/v1/customers

List all customers.

**Query Parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | 20 | Records per page (max 100) |
| `offset` | integer | 0 | Skip this many records |
| `sort` | string | `createdAt` | Sort field: `firstName`, `lastName`, `createdAt` |
| `order` | string | `desc` | Sort direction |
| `city` | string | — | Filter by city (matched against address) |

**Example**

```bash
curl "https://YOUR_APP.up.railway.app/api/v1/customers?limit=10&sort=firstName&order=asc"
```

---

### GET /api/v1/customers/:id

Retrieve a single customer.

---

### POST /api/v1/orders

Create a new order.

**Request Body** (JSON)

```json
{
  "customerId": "uuid",
  "restaurantId": "uuid",
  "deliveryAddress": "12 Awolowo Road, Lagos",
  "items": [
    { "menuItemId": "uuid", "quantity": 2 },
    { "menuItemId": "uuid", "quantity": 1 }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `customerId` | UUID | ✅ | Must reference an existing customer |
| `restaurantId` | UUID | ✅ | Must reference an existing restaurant |
| `deliveryAddress` | string | ✅ | Min 5 characters |
| `items` | array | ✅ | Min 1 item |
| `items[].menuItemId` | UUID | ✅ | Must belong to the specified restaurant |
| `items[].quantity` | integer | ✅ | Min 1 |

The `totalAmount` is computed server-side from current menu item prices.

**Example**

```bash
curl -X POST "https://YOUR_APP.up.railway.app/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "...",
    "restaurantId": "...",
    "deliveryAddress": "12 Awolowo Road, Lagos",
    "items": [{"menuItemId": "...", "quantity": 2}]
  }'
```

**Response: 201 Created**

```json
{
  "data": {
    "id": "order-uuid",
    "customerId": "...",
    "restaurantId": "...",
    "status": "pending",
    "totalAmount": 4000,
    "deliveryAddress": "12 Awolowo Road, Lagos",
    "createdAt": "...",
    "items": [...]
  }
}
```

**Errors**

| Status | Code | Cause |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid JSON body |
| 404 | `NOT_FOUND` | Customer or restaurant not found |
| 422 | `UNPROCESSABLE_ENTITY` | Missing/invalid fields, menu items don't belong to restaurant |

---

### GET /api/v1/orders

List orders.

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `status` | enum | Filter by status: `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled` |
| `customerId` | UUID | Filter by customer |
| `restaurantId` | UUID | Filter by restaurant |
| `sort` | string | `totalAmount`, `createdAt` |
| `order` | string | `asc`, `desc` |
| `limit` | integer | Max 100 |
| `offset` | integer | ≥ 0 |

---

### GET /api/v1/orders/:id

Retrieve a single order including its items.

---

### PATCH /api/v1/orders/:id

Update an order's status.

**Request Body**

```json
{ "status": "confirmed" }
```

Allowed status values: `pending`, `confirmed`, `preparing`, `out_for_delivery`, `delivered`, `cancelled`

---

### DELETE /api/v1/orders/:id

Delete an order (and its associated order items via cascade).

**Response: 204 No Content**

---

## Error Codes Reference

| HTTP Status | Code | Description |
|---|---|---|
| 400 | `BAD_REQUEST` | Invalid query parameter or malformed ID |
| 404 | `NOT_FOUND` | Resource does not exist |
| 422 | `UNPROCESSABLE_ENTITY` | Request body fails validation |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Unexpected server error |

---

## Rate Limiting

Every IP is limited to **100 requests per minute**.

When exceeded:
- HTTP 429 is returned
- A `Retry-After` header indicates seconds until the window resets
- Response body uses the standard error envelope

**Configuration** lives in `.env` (not inside any route handler):

```env
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

These values are read by `lib/config.ts` and injected into `lib/rateLimiter.ts`. To change limits, update the env vars and redeploy — no code changes needed.

---

## Seed Script

```bash
npm run seed
```

- Clears existing data in FK-safe order (OrderItem → Order → Customer → MenuItem → Restaurant)
- Uses a fixed Faker seed (`12345`) for deterministic output
- Generates 300 restaurants, 500+ menu items, 300 customers, 500+ orders
- Running twice produces the same data volume (delete then recreate)

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `RATE_LIMIT_MAX` | Max requests per window per IP | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `PAGINATION_DEFAULT_LIMIT` | Default page size | `20` |
| `PAGINATION_MAX_LIMIT` | Maximum page size | `100` |
| `NEXT_PUBLIC_API_URL` | Public API URL for the frontend | — (required) |

See `.env.example` for a template.

---

## Running Tests

```bash
# Against local dev server
API_BASE=http://localhost:3000 npx tsx tests/api.test.ts

# Against deployed API
API_BASE=https://YOUR_APP.up.railway.app npx tsx tests/api.test.ts
```

---

## Design Decisions

### 1. Why these resources?

Restaurant, MenuItem, Customer, Order, and OrderItem are the minimum set of entities required to model a realistic restaurant ordering system. Each resource has a clear real-world counterpart and meaningful relationships to the others. OrderItem was added (beyond the base 4) because it correctly models the many-to-many relationship between orders and menu items while storing the price snapshot at order time.

### 2. Resource relationships

A Restaurant owns many MenuItems. A Customer places many Orders. Each Order is placed at one Restaurant and has many OrderItems. Each OrderItem references one MenuItem. This creates a proper relational model where referential integrity is enforced by the database via foreign keys.

### 3. Why UUIDs instead of sequential integers?

Sequential integers leak business information (e.g., record count, growth rate) and allow clients to enumerate all resources by incrementing the ID (`/restaurants/1`, `/restaurants/2`…). UUID v4 identifiers are randomly generated, globally unique, and opaque to outside observers. They are also safe in distributed environments where multiple database writers might collide on sequential sequences.

### 4. Why offset pagination?

Offset pagination is conceptually simple, supports arbitrary page access (e.g., "jump to page 5"), and its performance is acceptable for datasets in the hundreds-of-thousands range with proper database indexes. Cursor pagination would be preferred for very large, frequently updated datasets (e.g., social media feeds) where offset becomes slow and results can shift between pages. For this restaurant API, offset pagination is the appropriate, explainable choice.

### 5. Response envelope design

A consistent `{ data, meta }` structure for collections and `{ data }` for single resources ensures clients can write one parsing layer that works everywhere. The `meta` block always includes `total`, `limit`, `offset`, and `hasMore`, so clients never need to compute pagination state themselves. The `{ error: { code, message } }` error envelope provides a machine-readable `code` for programmatic handling and a human-readable `message` for display.

### 6. Rate limiting configuration

The rate limit maximum and window are environment variables read from `lib/config.ts`, not hard-coded inside any route handler. This keeps all operational tuneables in one discoverable file and allows operators to adjust limits by setting env vars and redeploying — without touching source code. The default (100 req/min) is generous enough for legitimate API exploration but constrains automated abuse.

### 7. API versioning and evolution

All routes are prefixed `/api/v1/`. New fields added to a resource are non-breaking (existing clients ignore unknown fields). New required fields on POST endpoints would be added to a `/api/v2/` namespace rather than breaking `/api/v1/`. Deprecated fields would be documented and retained for a transition period.

---

## Project Structure

```
.
├── app/
│   ├── api/v1/
│   │   ├── restaurants/
│   │   │   ├── route.ts          # GET /restaurants
│   │   │   └── [id]/
│   │   │       ├── route.ts      # GET /restaurants/:id
│   │   │       └── menu/
│   │   │           └── route.ts  # GET /restaurants/:id/menu
│   │   ├── menu-items/
│   │   │   ├── route.ts          # GET /menu-items
│   │   │   └── [id]/route.ts     # GET /menu-items/:id
│   │   ├── customers/
│   │   │   ├── route.ts          # GET /customers
│   │   │   └── [id]/route.ts     # GET /customers/:id
│   │   └── orders/
│   │       ├── route.ts          # GET + POST /orders
│   │       └── [id]/route.ts     # GET + PATCH + DELETE /orders/:id
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                  # Frontend consumer
├── lib/
│   ├── config.ts                 # All configuration (single source of truth)
│   ├── envelope.ts               # Response/error helpers
│   ├── pagination.ts             # Pagination parsing + meta builder
│   ├── prisma.ts                 # Prisma singleton
│   ├── rateLimiter.ts            # IP rate limiting
│   ├── sorting.ts                # Sort field validation
│   └── utils.ts                  # UUID validator
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Repeatable seed script
├── tests/
│   └── api.test.ts               # API test suite
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
└── README.md
```
