import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { parseTeacherBody } from "@/lib/teachers/validation";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { teacherDisplayName } from "@/lib/teachers/display";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS))
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "מורה לא נמצאה" }, { status: 404 });
  return NextResponse.json({ teacher: data });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as Record<string, unknown>;
  const parsed = parseTeacherBody(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing } = await supabase
    .from("teachers")
    .select("academic_year_id")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מורה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      tz: parsed.tz,
      email: parsed.email,
      notes: parsed.notes,
    })
    .eq("id", id)
    .select(TEACHER_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // עדכון אוטומטי של teacher_snapshot בכל שורות exam_students של המורה הזו —
  // הוא היחיד במסד שמשכפל את שם המורה במקום לקרוא אותו דינמית מ-FK join.
  const newDisplayName = teacherDisplayName(data);
  const { data: examRows } = await supabase
    .from("exams")
    .select("id")
    .eq("teacher_id", id);
  const examIds = (examRows ?? []).map((r) => (r as { id: string }).id);
  let snapshotsUpdated = 0;
  if (examIds.length) {
    const { count, error: snapErr } = await supabase
      .from("exam_students")
      .update({ teacher_snapshot: newDisplayName }, { count: "exact" })
      .in("exam_id", examIds);
    if (snapErr) {
      console.warn("[PATCH /api/teachers/:id] לא הצלחתי לעדכן teacher_snapshot:", snapErr.message);
    } else {
      snapshotsUpdated = count ?? 0;
    }
  }

  return NextResponse.json({ teacher: data, snapshots_updated: snapshotsUpdated });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing } = await supabase
    .from("teachers")
    .select("academic_year_id")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מורה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }

  const { error } = await supabase
    .from("teachers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
