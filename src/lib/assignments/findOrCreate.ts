import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeTargetsFingerprint,
  type AssignmentMultiSpec,
} from "@/lib/assignments/multiTarget";
import { notDeleted } from "@/lib/db/softDelete";

export type { AssignmentMultiSpec };

type LessonFilterable<T> = {
  is(column: "lesson_name", value: null): T;
  eq(column: "lesson_name", value: string): T;
};

function applyLessonFilter<T extends LessonFilterable<T>>(query: T, lesson: string | null): T {
  if (lesson === null) return query.is("lesson_name", null);
  return query.eq("lesson_name", lesson);
}

export async function findOrCreateAssignment(
  supabase: SupabaseClient,
  academicYearId: string,
  spec: AssignmentMultiSpec,
): Promise<{ id: string; created: boolean } | { error: string }> {
  const fingerprint = computeTargetsFingerprint(spec);
  const lesson = spec.lesson_name?.trim() || null;

  const existingBase = notDeleted(supabase.from("teacher_assignments").select("id"))
    .eq("academic_year_id", academicYearId)
    .eq("teacher_id", spec.teacher_id)
    .eq("subject", spec.subject)
    .eq("assignment_category", spec.assignment_category)
    .eq("targets_fingerprint", fingerprint);
  const existing = await applyLessonFilter(existingBase, lesson).limit(1).maybeSingle();

  if (existing.error) return { error: existing.error.message };
  if (existing.data?.id) return { id: existing.data.id as string, created: false };

  const { data: inserted, error: insertErr } = await supabase
    .from("teacher_assignments")
    .insert({
      academic_year_id: academicYearId,
      teacher_id: spec.teacher_id,
      subject: spec.subject,
      lesson_name: lesson,
      assignment_category: spec.assignment_category,
      grade_levels: spec.grade_levels,
      class_ids: spec.class_ids,
      track_ids: spec.track_ids,
      specialization_ids: spec.specialization_ids,
      psychology_enabled: spec.psychology_enabled,
      applies_to_all_in_grade: spec.applies_to_all_in_grade,
      targets_fingerprint: fingerprint,
      teaching_mode: spec.teaching_mode,
    })
    .select("id")
    .single();

  if (!insertErr && inserted?.id) {
    return { id: inserted.id as string, created: true };
  }

  if (insertErr?.message.includes("uq_teacher_assignment_fingerprint")) {
    const retryBase = notDeleted(supabase.from("teacher_assignments").select("id"))
      .eq("academic_year_id", academicYearId)
      .eq("teacher_id", spec.teacher_id)
      .eq("subject", spec.subject)
      .eq("assignment_category", spec.assignment_category)
      .eq("targets_fingerprint", fingerprint);
    const retry = await applyLessonFilter(retryBase, lesson).limit(1).maybeSingle();
    if (retry.error) return { error: retry.error.message };
    if (retry.data?.id) return { id: retry.data.id as string, created: false };
  }

  return { error: insertErr?.message ?? "שגיאה ביצירת שיבוץ" };
}
