import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

/** מסנן רשומות שלא נמחקו ברכות (deleted_at IS NULL) */
export function notDeleted<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  column = "deleted_at",
): T {
  return query.is(column, null) as T;
}
