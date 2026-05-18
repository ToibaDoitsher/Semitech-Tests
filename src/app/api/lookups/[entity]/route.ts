import { NextResponse } from "next/server";
import { parseGradeLevelsFromName } from "@/lib/gradeLevels/options";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOOKUPS_WITH_IS_ACTIVE = new Set(["classes", "specializations", "tracks", "grade_level_options"]);

export async function GET(_request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();
  const selectCols = table === "grade_level_options" ? "id,name,grade_levels" : "id,name";
  let q = supabase.from(table).select(selectCols).order("name", { ascending: true });
  if (LOOKUPS_WITH_IS_ACTIVE.has(table)) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = { name };
  if (LOOKUPS_WITH_IS_ACTIVE.has(table)) row.is_active = true;
  if (table === "grade_level_options") {
    const grade_levels = parseGradeLevelsFromName(name);
    if (!grade_levels.length) {
      return NextResponse.json(
        { error: "שם שכבה לא תקין — למשל: א, ב, ג או א+ב" },
        { status: 400 },
      );
    }
    row.grade_levels = grade_levels;
  }
  const selectCols = table === "grade_level_options" ? "id,name,grade_levels" : "id,name";
  const { data, error } = await supabase.from(table).insert(row).select(selectCols).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
