import type { SupabaseClient } from "@supabase/supabase-js";
import { teachingTrackTypeLabel } from "@/lib/students/fields";
import type { GradeLevel, TeachingTrackType } from "@/lib/types/db";

type StudentSnapRow = {
  id: string;
  is_psychology: boolean;
  teaching_track_type: TeachingTrackType | null;
  classes: { name: string } | { name: string }[] | null;
  tracks: { name: string } | { name: string }[] | null;
  specializations: { name: string } | { name: string }[] | null;
  secondary_specializations: { name: string } | { name: string }[] | null;
};

function lookupName(v: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.name ?? null;
  return v.name ?? null;
}

export async function buildExamStudentRows(
  supabase: SupabaseClient,
  params: {
    examId: string;
    studentIds: string[];
    teacherName: string;
    subject: string;
    yearGroup: number;
    gradeLevel: GradeLevel;
    academicYearName: string | null;
    targetName: string | null;
  },
): Promise<Record<string, unknown>[]> {
  if (!params.studentIds.length) return [];

  const { data, error } = await supabase
    .from("students")
    .select(
      "id, is_psychology, teaching_track_type, classes(name), tracks(name), specializations:specializations!students_specialization_id_fkey(name), secondary_specializations:specializations!students_secondary_specialization_id_fkey(name)",
    )
    .in("id", params.studentIds);

  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((r) => [r.id as string, r as StudentSnapRow]));

  return params.studentIds.map((student_id) => {
    const s = byId.get(student_id);
    const tType = s?.teaching_track_type ?? null;
    return {
      exam_id: params.examId,
      student_id,
      status: "pending",
      class_snapshot: lookupName(s?.classes),
      track_snapshot: lookupName(s?.tracks),
      specialization_snapshot: lookupName(s?.specializations),
      secondary_specialization_snapshot: lookupName(s?.secondary_specializations),
      is_psychology_snapshot: s?.is_psychology ?? false,
      teaching_track_type_snapshot: tType ? teachingTrackTypeLabel(tType) : null,
      teacher_snapshot: params.teacherName,
      subject_snapshot: params.subject,
      year_group_snapshot: String(params.yearGroup),
      grade_level_snapshot: params.gradeLevel,
      academic_year_name_snapshot: params.academicYearName,
      target_name_snapshot: params.targetName,
    };
  });
}
