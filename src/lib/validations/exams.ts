import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";

export async function assertNoOpenMakeupDuplicate(
  supabase: SupabaseClient,
  studentId: string,
  examId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await notDeleted(
    supabase
      .from("makeup_exams")
      .select("id")
      .eq("student_id", studentId)
      .eq("exam_id", examId)
      .eq("status", "open")
      .limit(1),
  );
  if (error) return { ok: false, error: error.message };
  if (data?.length) {
    return { ok: false, error: "כבר קיימת השלמה פתוחה לתלמידה במבחן זה" };
  }
  return { ok: true, error: null };
}

export async function assertExamNotLocked(
  supabase: SupabaseClient,
  examId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("exams")
    .select("makeup_locked_at")
    .eq("id", examId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.makeup_locked_at) {
    return {
      ok: false,
      error: "המבחן ננעל לאחר העברה להשלמות — עדכון רק מכרטיס תלמידה",
    };
  }
  return { ok: true, error: null };
}

export async function assertValidExamStudentStatusTransition(
  supabase: SupabaseClient,
  examStudentId: string,
  nextStatus: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data: row, error } = await supabase
    .from("exam_students")
    .select("status, exam_id, student_id")
    .eq("id", examStudentId)
    .single();

  if (error || !row) return { ok: false, error: "רשומה לא נמצאה" };

  if (nextStatus === "took" && (row.status === "makeup" || row.status === "completed")) {
    return { ok: false, error: "תלמידה כבר בהשלמה — לא ניתן לסמן כנבחנה במועד" };
  }

  if (nextStatus === "missing" && row.status === "took") {
    return { ok: false, error: "תלמידה כבר נבחנה במועד" };
  }

  if (nextStatus === "took" && row.status === "completed") {
    return { ok: false, error: "תלמידה כבר השלימה את המבחן" };
  }

  if (nextStatus === "missing" && row.status === "makeup") {
    const dup = await assertNoOpenMakeupDuplicate(supabase, row.student_id as string, row.exam_id as string);
    if (!dup.ok) return dup;
  }

  if (nextStatus === "makeup" && row.status === "completed") {
    return { ok: false, error: "תלמידה כבר השלימה — לא ניתן להחזיר להשלמה" };
  }

  return { ok: true, error: null };
}
