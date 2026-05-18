import type { SupabaseClient } from "@supabase/supabase-js";
import { targetColumnsFromAssignment } from "@/lib/exams/logic";
import type { GradeLevel } from "@/lib/types/db";

type AssignmentTemplate = {
  id: string;
  grade_level: GradeLevel;
  teacher_id: string;
  subject: string;
  assignment_category: string;
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
  lesson_name?: string | null;
};

export async function resolveTeacherAssignmentForGrade(
  supabase: SupabaseClient,
  academicYearId: string,
  template: AssignmentTemplate,
  gradeLevel: GradeLevel,
): Promise<{ id: string } | { error: string }> {
  if (template.grade_level === gradeLevel) {
    return { id: template.id };
  }

  let q = supabase
    .from("teacher_assignments")
    .select("id")
    .eq("academic_year_id", academicYearId)
    .eq("teacher_id", template.teacher_id)
    .eq("subject", template.subject)
    .eq("grade_level", gradeLevel)
    .eq("assignment_category", template.assignment_category)
    .is("deleted_at", null);

  if (template.psychology_enabled) {
    q = q.eq("psychology_enabled", true);
  } else if (template.class_id) {
    q = q.eq("class_id", template.class_id);
  } else if (template.specialization_id) {
    q = q.eq("specialization_id", template.specialization_id);
  } else if (template.track_id) {
    q = q.eq("track_id", template.track_id);
  } else {
    return { error: `לא נמצא שיבוץ לשכבה ${gradeLevel}` };
  }

  const lesson = template.lesson_name?.trim();
  if (lesson) q = q.eq("lesson_name", lesson);
  else q = q.is("lesson_name", null);

  const { data, error } = await q.limit(1).maybeSingle();
  if (error) return { error: error.message };
  if (!data?.id) {
    return {
      error: `לא נמצא שיבוץ תואם לשכבה ${gradeLevel} (אותו מקצוע ויעד)`,
    };
  }
  return { id: data.id as string };
}

export { targetColumnsFromAssignment };
