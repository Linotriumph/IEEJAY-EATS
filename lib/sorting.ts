/**
 * lib/sorting.ts
 *
 * Validates ?sort=FIELD&order=asc|desc query parameters.
 *
 * Only explicitly listed fields are accepted.
 * An unknown sort field returns an error so the caller can return HTTP 400.
 * This prevents clients from accidentally sorting on internal columns
 * or causing query planner issues on un-indexed columns.
 */

export type SortOrder = "asc" | "desc";

export interface SortParams {
  field: string;
  order: SortOrder;
}

export type SortResult =
  | { ok: true; params: SortParams }
  | { ok: false; message: string };

export function parseSort(
  searchParams: URLSearchParams,
  allowedFields: readonly string[],
  defaultField: string,
  defaultOrder: SortOrder = "asc"
): SortResult {
  const rawSort = searchParams.get("sort");
  const rawOrder = searchParams.get("order");

  const field = rawSort ?? defaultField;
  const order: SortOrder =
    rawOrder === "asc" || rawOrder === "desc" ? rawOrder : defaultOrder;

  if (rawOrder !== null && rawOrder !== "asc" && rawOrder !== "desc") {
    return {
      ok: false,
      message: `order must be "asc" or "desc", got: ${rawOrder}`,
    };
  }

  if (!allowedFields.includes(field)) {
    return {
      ok: false,
      message: `sort field "${field}" is not supported. Allowed fields: ${allowedFields.join(", ")}`,
    };
  }

  return { ok: true, params: { field, order } };
}
