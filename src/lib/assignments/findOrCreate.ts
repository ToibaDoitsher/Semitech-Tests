import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import type { AssignmentCategory, GradeLevel, TeachingMode } from "@/lib/types/db";
import type { AssignmentTargetColumns } from "@/lib/assignments/target";

export type AssignmentFindOrCreateSpec = {
  teacher_id: string;
  grade_level: GradeLevel;
  subject: string;
  lesson_name: string | null;
  assignment_category: AssignmentCategory;
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
  teaching_mode: TeachingMode | null;
};

function buildFindQuery(
  supabase: SupabaseClient,
  academicYearId: string,
  spec: AssignmentFindOrCreateSpec,
) {
  let q = notDeleted(supabase.from("teacher_assignments").select("id"))
    .eq("academic_year_id", academicYearId)
    .eq("teacher_id", spec.teacher_id)
    .eq("subject", spec.subject)
    .eq("grade_level", spec.grade_level)
    .eq("assignment_category", spec.assignment_category);

  if (spec.psychology_enabled) {
    q = q.eq("psychology_enabled", true);
  } else if (spec.class_id) {
    q = q.eq("class_id", spec.class_id);
  } else if (spec.specialization_id) {
    q = q.eq("specialization_id", spec.specialization_id);
  } else if (spec.track_id) {
    q = q.eq("track_id", spec.track_id);
  }

  const lesson = spec.lesson_name?.trim();
  if (lesson) q = q.eq("lesson_name", lesson);
  else q = q.is("lesson_name", null);

  if (spec.teaching_mode) q = q.eq("teaching_mode", spec.teaching_mode);
  else q = q.is("teaching_mode", null);

  return q;
}

export function specFromTarget(
  base: Omit<AssignmentFindOrCreateSpec, keyof AssignmentTargetColumns> & {
    teaching_mode?: TeachingMode | null;
  },
  target: AssignmentTargetColumns,
): AssignmentFindOrCreateSpec {
  return {
    ...base,
    class_id: target.class_id,
    specialization_id: target.specialization_id,
    track_id: target.track_id,
    psychology_enabled: target.psychology_enabled,
    teaching_mode: base.teaching_mode ?? null,
  };
}

export async function findOrCreateAssignment(
  supabase: SupabaseClient,
  academicYearId: string,
  spec: AssignmentFindOrCreateSpec,
): Promise<{ id: string; created: boolean } | { error: string }> {
  const existing = await buildFindQuery(supabase, academicYearId, spec).limit(1).maybeSingle();
  if (existing.error) return { error: existing.error.message };
  if (existing.data?.id) return { id: existing.data.id as string, created: false };

  const lesson = spec.lesson_name?.trim() || null;
  const { data: inserted, error: insertErr } = await supabase
    .from("teacher_assignments")
    .insert({
      academic_year_id: academicYearId,
      teacher_id: spec.teacher_id,
      subject: spec.subject,
      lesson_name: lesson,
      assignment_category: spec.assignment_category,
      grade_level: spec.grade_level,
      class_id: spec.class_id,
      specialization_id: spec.specialization_id,
      track_id: spec.track_id,
      psychology_enabled: spec.psychology_enabled,
      teaching_mode: spec.teaching_mode,
    })
    .select("id")
    .single();

  if (!insertErr && inserted?.id) {
    return { id: inserted.id as string, created: true };
  }

  if (insertErr?.message.includes("uq_teacher_assignment")) {
    const retry = await buildFindQuery(supabase, academicYearId, spec).limit(1).maybeSingle();
    if (retry.error) return { error: retry.error.message };
    if (retry.data?.id) return { id: retry.data.id as string, created: false };
  }

  return { error: insertErr?.message ?? "שגיאה ביצירת שיבוץ" };
}
