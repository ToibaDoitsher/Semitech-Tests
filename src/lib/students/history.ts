import type { SupabaseClient } from "@supabase/supabase-js";
import type { GradeLevel } from "@/lib/academicYears/types";

type StudentRow = {
  class_id: string;
  specialization_id: string | null;
  track_id: string | null;
  year_group: number;
  grade_level: GradeLevel;
};

export async function recordStudentHistoryIfChanged(
  supabase: SupabaseClient,
  studentId: string,
  before: StudentRow,
  after: StudentRow,
  changedBy: string | null,
) {
  const changed =
    before.class_id !== after.class_id ||
    before.specialization_id !== after.specialization_id ||
    before.track_id !== after.track_id ||
    before.year_group !== after.year_group ||
    before.grade_level !== after.grade_level;

  if (!changed) return;

  await supabase.from("student_history").insert({
    student_id: studentId,
    old_year_group: before.year_group,
    new_year_group: after.year_group,
    old_grade_level: before.grade_level,
    new_grade_level: after.grade_level,
    old_class_id: before.class_id,
    new_class_id: after.class_id,
    old_specialization_id: before.specialization_id,
    new_specialization_id: after.specialization_id,
    old_track_id: before.track_id,
    new_track_id: after.track_id,
    changed_by: changedBy,
  });
}
