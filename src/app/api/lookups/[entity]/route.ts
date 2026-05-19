import { NextResponse } from "next/server";
import { parseGradeLevelsFromName } from "@/lib/gradeLevels/options";
import { resolveAcademicYearScope, readOnlyResponse, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOOKUPS_WITH_IS_ACTIVE = new Set(["classes", "specializations", "tracks", "grade_level_options"]);

export async function GET(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  try {
    const { entity } = await ctx.params;
    if (!isLookupEntity(entity)) {
      return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
    }

    const table = ENTITY_TO_TABLE[entity];
    const supabase = createSupabaseAdminClient();
    const selectCols = table === "grade_level_options" ? "id,name,grade_levels" : "id,name";
    let q = supabase.from(table).select(selectCols).order("name", { ascending: true });

    if (isYearScopedLookup(entity)) {
      const scope = await resolveAcademicYearScope(
        supabase,
        scopeFromSearchParams(new URL(request.url).searchParams),
      );
      q = q.eq("academic_year_id", scope.year.id).is("deleted_at", null);
    }

    if (LOOKUPS_WITH_IS_ACTIVE.has(table)) {
      q = q.eq("is_active", true);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: dbSchemaHint(error.message) }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: dbSchemaHint((e as Error).message), items: [] }, { status: 500 });
  }
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

  if (isYearScopedLookup(entity)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }
    row.academic_year_id = scope.year.id;
  }

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
