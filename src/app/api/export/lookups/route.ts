import { NextResponse } from "next/server";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = (searchParams.get("entity") ?? "").trim();
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });
  }

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();
  let q = supabase.from(table).select("id, name").order("name");

  if (isYearScopedLookup(entity)) {
    const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
    q = q.eq("academic_year_id", scope.year.id).is("deleted_at", null).eq("is_active", true);
  } else if (table === "grade_level_options") {
    q = q.eq("is_active", true);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r) => {
    const row = r as { name: string };
    return { שם: row.name };
  });
  return NextResponse.json({ rows });
}
