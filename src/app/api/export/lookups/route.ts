import { NextResponse } from "next/server";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entity = (searchParams.get("entity") ?? "").trim();
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });
  }

  const table = ENTITY_TO_TABLE[entity] as "grade_levels" | "classes" | "specializations" | "tracks";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from(table).select("id, name").order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r) => {
    const row = r as { name: string };
    return { שם: row.name };
  });
  return NextResponse.json({ rows });
}
