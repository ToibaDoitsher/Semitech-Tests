import { NextResponse } from "next/server";
import {
  normalizeTargetInput,
  parseAssignmentCategory,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import type { AssignmentCategory } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing, error: loadErr } = await notDeleted(
    supabase
      .from("teacher_assignments")
      .select(
        "id, assignment_category, class_id, specialization_id, track_id, psychology_enabled",
      ),
  )
    .eq("id", id)
    .eq("academic_year_id", scope.year.id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });

  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    lesson_name?: string | null;
    year_group?: number;
    grade_level?: string;
    assignment_category?: string;
    class_id?: string | null;
    specialization_id?: string | null;
    track_id?: string | null;
    psychology_enabled?: boolean;
    teaching_mode?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.teacher_id !== undefined) {
    const tid = body.teacher_id.trim();
    if (!tid) return NextResponse.json({ error: "מורה חובה" }, { status: 400 });
    patch.teacher_id = tid;
  }
  if (body.subject !== undefined) patch.subject = body.subject.trim();
  if (body.lesson_name !== undefined) patch.lesson_name = (body.lesson_name ?? "").trim() || null;
  if (body.year_group !== undefined) patch.year_group = body.year_group;
  if (body.grade_level !== undefined) {
    const gl = parseGradeLevel(body.grade_level);
    if (!gl) return NextResponse.json({ error: "שכבה לא תקינה" }, { status: 400 });
    patch.grade_level = gl;
  }

  let category = existing.assignment_category as AssignmentCategory;
  if (body.assignment_category !== undefined) {
    const parsed = parseAssignmentCategory(body.assignment_category);
    if (!parsed) return NextResponse.json({ error: "סוג שיבוץ לא תקין" }, { status: 400 });
    category = parsed;
    patch.assignment_category = category;
  }

  const targetTouched =
    body.assignment_category !== undefined ||
    body.class_id !== undefined ||
    body.specialization_id !== undefined ||
    body.track_id !== undefined ||
    body.psychology_enabled !== undefined;

  if (targetTouched) {
    let class_id = body.class_id !== undefined ? body.class_id : existing.class_id;
    let specialization_id =
      body.specialization_id !== undefined ? body.specialization_id : existing.specialization_id;
    let track_id = body.track_id !== undefined ? body.track_id : existing.track_id;
    let psychology_enabled =
      body.psychology_enabled !== undefined ? body.psychology_enabled : existing.psychology_enabled;

    if (body.assignment_category !== undefined) {
      class_id = null;
      specialization_id = null;
      track_id = null;
      psychology_enabled = false;
    }

    const target = normalizeTargetInput({
      class_id,
      specialization_id,
      track_id,
      psychology_enabled,
    });
    const targetErr = validateAssignmentWithCategory(category, target);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });
    patch.class_id = target.class_id;
    patch.specialization_id = target.specialization_id;
    patch.track_id = target.track_id;
    patch.psychology_enabled = target.psychology_enabled;
  }

  const trackIdForTeaching =
    category === "חובה"
      ? ((patch.track_id as string | null | undefined) ?? existing.track_id ?? null)
      : null;

  if (body.teaching_mode !== undefined) {
    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      trackIdForTeaching,
      body.teaching_mode,
    );
    if (teaching.error) {
      return NextResponse.json({ error: teaching.error }, { status: 400 });
    }
    patch.teaching_mode = teaching.teaching_mode;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("teacher_assignments")
    .update(patch)
    .eq("id", id)
    .select(ASSIGNMENT_WITH_LOOKUPS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { error } = await supabase
    .from("teacher_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
