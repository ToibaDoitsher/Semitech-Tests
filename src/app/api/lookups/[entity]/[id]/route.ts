import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { parseGradeLevelsFromName } from "@/lib/gradeLevels/options";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOOKUPS_WITH_IS_ACTIVE = new Set(["classes", "specializations", "tracks", "grade_level_options"]);
const YEAR_SCOPED_TABLES = new Set(["classes", "specializations", "tracks"]);

export async function PATCH(request: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string; is_active?: boolean };
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });
    patch.name = name;
  }
  if (body.is_active !== undefined) patch.is_active = body.is_active;

  const table = ENTITY_TO_TABLE[entity];
  if (table === "grade_level_options" && body.name !== undefined) {
    const grade_levels = parseGradeLevelsFromName(String(patch.name));
    if (!grade_levels.length) {
      return NextResponse.json(
        { error: "שם שכבה לא תקין — למשל: א, ב, ג או א+ב" },
        { status: 400 },
      );
    }
    patch.grade_levels = grade_levels;
  }

  const supabase = createSupabaseAdminClient();

  if (YEAR_SCOPED_TABLES.has(table)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }
    const { data: existing } = await supabase
      .from(table)
      .select("academic_year_id")
      .eq("id", id)
      .maybeSingle();
    if (existing && existing.academic_year_id !== scope.year.id) {
      return NextResponse.json({ error: "פריט לא שייך לשנה הנוכחית" }, { status: 403 });
    }
  }

  const selectCols = table === "grade_level_options" ? "id,name,grade_levels" : "id,name";
  const { data, error } = await supabase.from(table).update(patch).eq("id", id).select(selectCols).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const { entity, id } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();

  if (YEAR_SCOPED_TABLES.has(table)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }
    const { data: existing } = await supabase
      .from(table)
      .select("academic_year_id")
      .eq("id", id)
      .maybeSingle();
    if (existing && existing.academic_year_id !== scope.year.id) {
      return NextResponse.json({ error: "פריט לא שייך לשנה הנוכחית" }, { status: 403 });
    }
  }

  if (LOOKUPS_WITH_IS_ACTIVE.has(table)) {
    const { data, error } = await supabase
      .from(table)
      .update({ is_active: false })
      .eq("id", id)
      .select("id,name")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data, deactivated: true });
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
