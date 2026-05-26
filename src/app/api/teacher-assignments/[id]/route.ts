import { NextResponse } from "next/server";
import {
  computeTargetsFingerprint,
  normalizeMultiTargetInput,
  rowToMultiTarget,
  validateMultiTarget,
} from "@/lib/assignments/multiTarget";
import { parseAssignmentCategory } from "@/lib/assignments/target";
import { filterGradeLevels } from "@/lib/gradeLevels/options";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { normalizeSubjectLessonFields } from "@/lib/assignments/excelImport";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { isTeachingTrackName } from "@/lib/students/fields";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import { isTeachingModeSelection } from "@/lib/teachers/teachingMode";
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
    supabase.from("teacher_assignments").select("*"),
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
    grade_levels?: string[];
    assignment_category?: string;
    class_ids?: string[];
    track_ids?: string[];
    specialization_ids?: string[];
    psychology_enabled?: boolean;
    applies_to_all_in_grade?: boolean;
    teaching_mode?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.teacher_id !== undefined) {
    const tid = body.teacher_id.trim();
    if (!tid) return NextResponse.json({ error: "מורה חובה" }, { status: 400 });
    patch.teacher_id = tid;
  }
  if (body.subject !== undefined || body.lesson_name !== undefined) {
    const subjectLesson = normalizeSubjectLessonFields(
      body.subject ?? String(existing.subject ?? ""),
      body.lesson_name ?? String(existing.lesson_name ?? ""),
    );
    if (subjectLesson.error) {
      return NextResponse.json({ error: subjectLesson.error }, { status: 400 });
    }
    patch.subject = subjectLesson.subject;
    patch.lesson_name = subjectLesson.lesson_name;
  }

  let category = existing.assignment_category as AssignmentCategory;
  if (body.assignment_category !== undefined) {
    const parsed = parseAssignmentCategory(body.assignment_category);
    if (!parsed) return NextResponse.json({ error: "סוג שיבוץ לא תקין" }, { status: 400 });
    category = parsed;
    patch.assignment_category = category;
  }

  const current = rowToMultiTarget(existing);
  const nextTarget = normalizeMultiTargetInput({
    grade_levels:
      body.grade_levels !== undefined
        ? filterGradeLevels(body.grade_levels)
        : current.grade_levels,
    class_ids: body.class_ids !== undefined ? body.class_ids : current.class_ids,
    track_ids: body.track_ids !== undefined ? body.track_ids : current.track_ids,
    specialization_ids:
      body.specialization_ids !== undefined
        ? body.specialization_ids
        : current.specialization_ids,
    psychology_enabled:
      body.psychology_enabled !== undefined
        ? body.psychology_enabled
        : current.psychology_enabled,
    applies_to_all_in_grade:
      body.applies_to_all_in_grade !== undefined
        ? body.applies_to_all_in_grade
        : current.applies_to_all_in_grade,
  });

  const targetErr = validateMultiTarget(category, nextTarget);
  if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

  patch.grade_levels = nextTarget.grade_levels;
  patch.class_ids = nextTarget.class_ids;
  patch.track_ids = nextTarget.track_ids;
  patch.specialization_ids = nextTarget.specialization_ids;
  patch.psychology_enabled = nextTarget.psychology_enabled;
  patch.applies_to_all_in_grade = nextTarget.applies_to_all_in_grade;
  patch.targets_fingerprint = computeTargetsFingerprint(nextTarget);

  const trackIdForTeaching =
    category === "חובה" && nextTarget.track_ids.length === 1
      ? nextTarget.track_ids[0]
      : null;

  if (body.teaching_mode !== undefined) {
    if (trackIdForTeaching) {
      const { data: trackRow } = await supabase
        .from("tracks")
        .select("name")
        .eq("id", trackIdForTeaching)
        .maybeSingle();
      if (isTeachingTrackName((trackRow?.name as string) ?? "")) {
        const raw = String(body.teaching_mode ?? "").trim();
        if (!isTeachingModeSelection(raw)) {
          return NextResponse.json(
            { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" },
            { status: 400 },
          );
        }
      }
    }
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
