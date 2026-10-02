/**
 * lib/prisma.ts
 *
 * Singleton Prisma client.
 *
 * Next.js hot-reloads modules in development, which would create a new
 * PrismaClient on every reload and exhaust the database connection pool.
 * Storing the instance on the Node.js global object prevents that.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
