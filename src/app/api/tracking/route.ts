import { NextResponse } from "next/server";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );

  const SELECT_WITH_SUBMISSION =
    "id, submitted_exam, student_submission_date, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id";
  const SELECT_LEGACY =
    "id, submitted_exam, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id";

  const first = await supabase
    .from("exam_tracking")
    .select(SELECT_WITH_SUBMISSION)
    .eq("academic_year_id", scope.year.id)
    .order("id", { ascending: false });

  let rows: Array<Record<string, unknown>> | null = (first.data ?? null) as
    | Array<Record<string, unknown>>
    | null;
  let error = first.error;

  if (error && /student_submission_date/i.test(error.message)) {
    const legacy = await supabase
      .from("exam_tracking")
      .select(SELECT_LEGACY)
      .eq("academic_year_id", scope.year.id)
      .order("id", { ascending: false });
    rows = (legacy.data ?? null) as Array<Record<string, unknown>> | null;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examIds = [...new Set((rows ?? []).map((r) => r.exam_id as string))];
  let examsBy: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> = {};

  if (examIds.length) {
    const { data: exams } = await supabase
      .from("exams")
      .select(`id, subject, exam_date, ${TEACHER_EMBED_IN_EXAM}`)
      .in("id", examIds);
    for (const e of exams ?? []) {
      const raw = e as { id: string; subject: string; exam_date: string; teachers: unknown };
      examsBy[raw.id] = {
        subject: raw.subject,
        exam_date: raw.exam_date,
        teacher_name:
          teacherEmbedDisplayName(
            raw.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
          ) || null,
      };
    }
  }

  const tracking = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown> & { exam_id: string };
    return {
      ...row,
      student_submission_date: (row.student_submission_date as string | null | undefined) ?? null,
      exam: examsBy[row.exam_id] ?? null,
    };
  });

  return NextResponse.json({ tracking });
}
