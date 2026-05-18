import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import { isTeachingTrackName, type TeachingTrackType } from "@/lib/students/fields";
import type { ExamTargetType, GradeLevel } from "@/lib/types/db";

export type FetchStudentsOptions = {
  teachingTrackType?: TeachingTrackType | null;
};

export type YearGradeScope = {
  academic_year_id: string;
  year_group: number;
  grade_level: GradeLevel;
};

export async function fetchStudentIdsForTarget(
  supabase: SupabaseClient,
  targetType: ExamTargetType,
  targetId: string,
  scope?: YearGradeScope,
  options?: FetchStudentsOptions,
): Promise<{ ids: string[]; error: string | null }> {
  if (targetType === "psychology") {
    let q = notDeleted(supabase.from("students").select("id")).eq("is_psychology", true);
    if (scope) {
      q = q
        .eq("academic_year_id", scope.academic_year_id)
        .eq("year_group", scope.year_group)
        .eq("grade_level", scope.grade_level);
    }
    const { data, error } = await q;
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  if (targetType === "specialization") {
    let q = notDeleted(supabase.from("students").select("id")).or(
      `specialization_id.eq.${targetId},secondary_specialization_id.eq.${targetId}`,
    );
    if (scope) {
      q = q
        .eq("academic_year_id", scope.academic_year_id)
        .eq("year_group", scope.year_group)
        .eq("grade_level", scope.grade_level);
    }
    const { data, error } = await q;
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  if (targetType === "track") {
    const { data: trackRow } = await supabase.from("tracks").select("name").eq("id", targetId).maybeSingle();
    const trackName = (trackRow?.name as string) ?? "";
    let q = notDeleted(supabase.from("students").select("id")).eq("track_id", targetId);
    if (scope) {
      q = q
        .eq("academic_year_id", scope.academic_year_id)
        .eq("year_group", scope.year_group)
        .eq("grade_level", scope.grade_level);
    }
    if (isTeachingTrackName(trackName) && options?.teachingTrackType) {
      q = q.eq("teaching_track_type", options.teachingTrackType);
    }
    const { data, error } = await q;
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  const col = targetType === "class" ? "class_id" : "track_id";
  let q = notDeleted(supabase.from("students").select("id")).eq(col, targetId);
  if (scope) {
    q = q
      .eq("academic_year_id", scope.academic_year_id)
      .eq("year_group", scope.year_group)
      .eq("grade_level", scope.grade_level);
  }

  const { data, error } = await q;
  if (error) return { ids: [], error: error.message };
  return { ids: (data ?? []).map((r) => r.id as string), error: null };
}

export async function assertTeacherAssignmentMatchesExam(
  supabase: SupabaseClient,
  teacherId: string,
  subject: string,
  targetType: ExamTargetType,
  targetId: string,
  scope: YearGradeScope,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await notDeleted(
    supabase.from("teacher_assignments").select("id"),
  )
    .eq("academic_year_id", scope.academic_year_id)
    .eq("teacher_id", teacherId)
    .eq("subject", subject)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("year_group", scope.year_group)
    .eq("grade_level", scope.grade_level)
    .limit(1);

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
