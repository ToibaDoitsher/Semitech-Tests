import type { SupabaseClient } from "@supabase/supabase-js";

export function makeupTrackingTableHint(message: string): string {
  if (/makeup_tracking|schema cache/i.test(message)) {
    return "טבלת מעקב השלמות חסרה — הריצי supabase/PATCH_MAKEUP_TRACKING.sql ב-Supabase SQL Editor";
  }
  if (/grade_levels|column.*exams/i.test(message)) {
    return "סכמת מבחנים לא מעודכנת — הריצי supabase/PATCH_ASSIGNMENT_MULTI_TARGET.sql ב-Supabase SQL Editor";
  }
  return message;
}

async function loadExamForMakeup(
  supabase: SupabaseClient,
  examId: string,
): Promise<{ academicYearId: string; teacherId: string } | { error: string }> {
  const { data: exam, error } = await supabase
    .from("exams")
    .select("id, teacher_id, academic_year_id")
    .eq("id", examId)
    .maybeSingle();

  if (error) return { error: makeupTrackingTableHint(error.message) };
  if (!exam?.academic_year_id) return { error: "מבחן לא נמצא" };
  return {
    academicYearId: exam.academic_year_id as string,
    teacherId: exam.teacher_id as string,
  };
}

export async function ensureMakeupTracking(
  supabase: SupabaseClient,
  params: { studentId: string; examId: string; makeupExamId?: string | null },
): Promise<{ error: string | null }> {
  const examRes = await loadExamForMakeup(supabase, params.examId);
  if ("error" in examRes) return { error: examRes.error };

  const row: Record<string, unknown> = {
    academic_year_id: examRes.academicYearId,
    exam_id: params.examId,
    teacher_id: examRes.teacherId,
    student_id: params.studentId,
  };
  if (params.makeupExamId) row.makeup_exam_id = params.makeupExamId;

  const { error } = await supabase.from("makeup_tracking").upsert(row, {
    onConflict: "exam_id,student_id",
    ignoreDuplicates: false,
  });

  return { error: error ? makeupTrackingTableHint(error.message) : null };
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

/** מסנכרן רשומות makeup_exams לטבלת המעקב */
export async function backfillMakeupTrackingFromMakeups(
  supabase: SupabaseClient,
  academicYearId?: string,
): Promise<{ error: string | null; synced: number }> {
  let q = supabase
    .from("makeup_exams")
    .select("id, academic_year_id, exam_id, student_id, grade, notes");
  if (academicYearId) q = q.eq("academic_year_id", academicYearId);

  const { data: makeups, error: loadErr } = await q;
  if (loadErr) return { error: makeupTrackingTableHint(loadErr.message), synced: 0 };
  if (!makeups?.length) return { error: null, synced: 0 };

  const examIds = [...new Set(makeups.map((m) => m.exam_id as string))];
  const { data: exams, error: examErr } = await supabase
    .from("exams")
    .select("id, teacher_id, academic_year_id")
    .in("id", examIds);
  if (examErr) return { error: examErr.message, synced: 0 };

  const examBy = new Map((exams ?? []).map((e) => [e.id as string, e]));

  const rows = makeups
    .map((m) => {
      const exam = examBy.get(m.exam_id as string);
      if (!exam) return null;
      return {
        academic_year_id: (m.academic_year_id as string) ?? (exam.academic_year_id as string),
        exam_id: m.exam_id as string,
        teacher_id: exam.teacher_id as string,
        student_id: m.student_id as string,
        makeup_exam_id: m.id as string,
        grade: m.grade as number | null,
        notes: m.notes as string | null,
      };
    })
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  if (!rows.length) return { error: null, synced: 0 };

  const { error } = await supabase.from("makeup_tracking").upsert(rows, {
    onConflict: "exam_id,student_id",
    ignoreDuplicates: false,
  });
  if (error) return { error: makeupTrackingTableHint(error.message), synced: 0 };
  return { error: null, synced: rows.length };
}
