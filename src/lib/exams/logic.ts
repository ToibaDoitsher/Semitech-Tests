import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import type { ExamTargetType } from "@/lib/types/db";

export async function fetchStudentIdsForTarget(
  supabase: SupabaseClient,
  targetType: ExamTargetType,
  targetId: string,
  cohortId?: string,
): Promise<{ ids: string[]; error: string | null }> {
  const col =
    targetType === "class"
      ? "class_id"
      : targetType === "specialization"
        ? "specialization_id"
        : "track_id";

  let q = notDeleted(supabase.from("students").select("id")).eq(col, targetId);
  if (cohortId) q = q.eq("cohort_id", cohortId);

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
  cohortId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await notDeleted(
    supabase.from("teacher_assignments").select("id"),
  )
    .eq("teacher_id", teacherId)
    .eq("subject", subject)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("cohort_id", cohortId)
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
