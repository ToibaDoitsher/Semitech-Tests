import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateAssignment } from "@/lib/assignments/findOrCreate";
import { targetColumnsFromAssignment } from "@/lib/exams/logic";
import type { AssignmentCategory, GradeLevel, TeachingMode } from "@/lib/types/db";

export type AssignmentTemplate = {
  id: string;
  grade_level: GradeLevel;
  teacher_id: string;
  subject: string;
  assignment_category: AssignmentCategory;
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
  lesson_name?: string | null;
  teaching_mode?: TeachingMode | null;
};

export async function resolveTeacherAssignmentForGrade(
  supabase: SupabaseClient,
  academicYearId: string,
  template: AssignmentTemplate,
  gradeLevel: GradeLevel,
): Promise<{ id: string; created?: boolean } | { error: string }> {
  if (template.grade_level === gradeLevel) {
    return { id: template.id };
  }

  const lesson = template.lesson_name?.trim() || null;
  const result = await findOrCreateAssignment(supabase, academicYearId, {
    teacher_id: template.teacher_id,
    grade_level: gradeLevel,
    subject: template.subject,
    lesson_name: lesson,
    assignment_category: template.assignment_category,
    class_id: template.class_id,
    specialization_id: template.specialization_id,
    track_id: template.track_id,
    psychology_enabled: template.psychology_enabled,
    teaching_mode: template.teaching_mode ?? null,
  });

  if ("error" in result) return { error: result.error };
  return { id: result.id, created: result.created };
}

export { targetColumnsFromAssignment };
