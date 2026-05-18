import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignmentTargetMatches,
  fetchStudentIdsForAssignmentTarget,
  normalizeTargetInput,
  type AssignmentTargetColumns,
  type YearGradeScope,
} from "@/lib/assignments/target";
import { notDeleted } from "@/lib/db/softDelete";
import { isTeachingTrackName, type TeachingTrackType } from "@/lib/students/fields";

export type { YearGradeScope, AssignmentTargetColumns };
export { fetchStudentIdsForAssignmentTarget as fetchStudentIdsForTarget };

export type FetchStudentsOptions = {
  teachingTrackType?: TeachingTrackType | null;
};

export async function assertTeacherAssignmentMatchesExam(
  supabase: SupabaseClient,
  teacherId: string,
  subject: string,
  target: AssignmentTargetColumns,
  scope: YearGradeScope,
): Promise<{ ok: boolean; error: string | null }> {
  let q = notDeleted(supabase.from("teacher_assignments").select("id"))
    .eq("academic_year_id", scope.academic_year_id)
    .eq("teacher_id", teacherId)
    .eq("subject", subject)
    .eq("year_group", scope.year_group)
    .eq("grade_level", scope.grade_level);

  if (target.psychology_enabled) q = q.eq("psychology_enabled", true);
  else if (target.class_id) q = q.eq("class_id", target.class_id);
  else if (target.specialization_id) q = q.eq("specialization_id", target.specialization_id);
  else if (target.track_id) q = q.eq("track_id", target.track_id);
  else return { ok: false, error: "יעד שיבוץ לא תקין" };

  const { data, error } = await q.limit(1);
  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return {
      ok: false,
      error: "אין שיבוץ פעיל למורה במקצוע זה, בשנתון ובאותו יעד",
    };
  }
  return { ok: true, error: null };
}

export async function isTeachingTrackId(supabase: SupabaseClient, trackId: string): Promise<boolean> {
  const { data } = await supabase.from("tracks").select("name").eq("id", trackId).maybeSingle();
  return isTeachingTrackName((data?.name as string) ?? "");
}

export function targetColumnsFromAssignment(row: {
  class_id?: string | null;
  specialization_id?: string | null;
  track_id?: string | null;
  psychology_enabled?: boolean;
}): AssignmentTargetColumns {
  return normalizeTargetInput({
    class_id: row.class_id,
    specialization_id: row.specialization_id,
    track_id: row.track_id,
    psychology_enabled: row.psychology_enabled,
  });
}

export function assignmentsMatchExamTarget(
  assignment: AssignmentTargetColumns,
  exam: AssignmentTargetColumns,
): boolean {
  return assignmentTargetMatches(assignment, exam);
}
