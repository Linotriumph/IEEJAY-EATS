/**
 * lib/utils.ts
 *
 * Shared utility functions used across the API handlers.
 */

/**
 * UUID v4 regex.
 * Validates that an ID string is a well-formed UUID before hitting the DB.
 * This prevents a Prisma error (and accidental HTTP 500) when a client
 * passes a malformed ID like "abc" or "123".
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
