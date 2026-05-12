import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExamTargetType } from "@/lib/types/db";

export async function fetchStudentIdsForTarget(
  supabase: SupabaseClient,
  targetType: ExamTargetType,
  targetId: string,
): Promise<{ ids: string[]; error: string | null }> {
  const col =
    targetType === "class"
      ? "class_id"
      : targetType === "specialization"
        ? "specialization_id"
        : "track_id";

  const { data, error } = await supabase.from("students").select("id").eq(col, targetId);

  if (error) return { ids: [], error: error.message };
  return { ids: (data ?? []).map((r) => r.id as string), error: null };
}

/** שיבוץ פעיל שמקשר מורה + מקצוע + אותו יעד כמו המבחן */
export async function assertTeacherAssignmentMatchesExam(
  supabase: SupabaseClient,
  teacherId: string,
  subject: string,
  targetType: ExamTargetType,
  targetId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("subject", subject)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("active", true)
    .limit(1);

  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return {
      ok: false,
      error: "אין שיבוץ פעיל למורה במקצוע זה ובאותו יעד (כיתה/התמחות/מסלול)",
    };
  }
  return { ok: true, error: null };
}
