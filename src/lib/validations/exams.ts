import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import type { ExamTargetType } from "@/lib/types/db";

export async function assertNoDuplicateExam(
  supabase: SupabaseClient,
  params: {
    cohortId: string;
    teacherId: string;
    subject: string;
    targetType: ExamTargetType;
    targetId: string;
    examDate: string;
    excludeExamId?: string;
  },
): Promise<{ ok: boolean; error: string | null }> {
  let q = notDeleted(
    supabase
      .from("exams")
      .select("id")
      .eq("cohort_id", params.cohortId)
      .eq("teacher_id", params.teacherId)
      .eq("subject", params.subject.trim())
      .eq("target_type", params.targetType)
      .eq("target_id", params.targetId)
      .eq("exam_date", params.examDate)
      .limit(1),
  );

  if (params.excludeExamId) q = q.neq("id", params.excludeExamId);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  if (data?.length) {
    return { ok: false, error: "כבר קיים מבחן זהה לאותה קבוצה באותו תאריך" };
  }
  return { ok: true, error: null };
}

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

  return { ok: true, error: null };
}
