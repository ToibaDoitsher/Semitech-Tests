import { NextResponse } from "next/server";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "ישות לא תקינה" }, { status: 400 });
  }

  const table = ENTITY_TO_TABLE[entity] as "grade_levels" | "classes" | "specializations" | "tracks";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from(table).delete().not("id", "is", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
