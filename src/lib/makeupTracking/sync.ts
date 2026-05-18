import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureMakeupTracking(
  supabase: SupabaseClient,
  params: { studentId: string; examId: string; makeupExamId?: string | null },
): Promise<{ error: string | null }> {
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("id, teacher_id, academic_year_id")
    .eq("id", params.examId)
    .maybeSingle();

  if (examErr) return { error: examErr.message };
  if (!exam) return { error: "מבחן לא נמצא" };

  const row: Record<string, unknown> = {
    academic_year_id: exam.academic_year_id,
    exam_id: params.examId,
    teacher_id: exam.teacher_id,
    student_id: params.studentId,
  };
  if (params.makeupExamId) row.makeup_exam_id = params.makeupExamId;

  const { error } = await supabase.from("makeup_tracking").upsert(row, {
    onConflict: "exam_id,student_id",
    ignoreDuplicates: false,
  });

  return { error: error?.message ?? null };
}

export async function ensureMakeupTrackingBatch(
  supabase: SupabaseClient,
  items: { studentId: string; examId: string; makeupExamId?: string | null }[],
): Promise<{ error: string | null }> {
  for (const item of items) {
    const res = await ensureMakeupTracking(supabase, item);
    if (res.error) return res;
  }
  return { error: null };
}
