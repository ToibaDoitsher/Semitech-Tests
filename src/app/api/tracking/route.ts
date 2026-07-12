import { NextResponse } from "next/server";
import { resolveScopeFromUrl } from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SELECT_FULL =
  "id, submitted_exam, student_submission_date, reminder_1_hindi, reminder_2_biller, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id";
const SELECT_WITHOUT_REMINDERS =
  "id, submitted_exam, student_submission_date, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id";
const SELECT_LEGACY =
  "id, submitted_exam, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id";

function isMissingColumnError(message: string, column: string): boolean {
  return new RegExp(column, "i").test(message);
}

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveScopeFromUrl(supabase, new URL(request.url).searchParams);

  let selectFields = SELECT_FULL;
  let rows: Array<Record<string, unknown>> | null = null;
  let error: { message: string } | null = null;

  for (const fields of [SELECT_FULL, SELECT_WITHOUT_REMINDERS, SELECT_LEGACY]) {
    selectFields = fields;
    const result = await supabase
      .from("exam_tracking")
      .select(fields)
      .eq("academic_year_id", scope.year.id)
      .eq("term", scope.term)
      .order("id", { ascending: false });
    rows = (result.data ?? null) as Array<Record<string, unknown>> | null;
    error = result.error;
    if (!error) break;
    const msg = error.message;
    if (
      isMissingColumnError(msg, "reminder_1_hindi") ||
      isMissingColumnError(msg, "reminder_2_biller") ||
      isMissingColumnError(msg, "student_submission_date")
    ) {
      continue;
    }
    if (isMissingColumnError(msg, "term")) {
      return NextResponse.json({ error: dbSchemaHint(msg) }, { status: 500 });
    }
    break;
  }

  if (error) return NextResponse.json({ error: dbSchemaHint(error.message) }, { status: 500 });

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

  const hasStudentSubmission = selectFields.includes("student_submission_date");
  const hasReminders = selectFields.includes("reminder_1_hindi");

  const tracking = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown> & { exam_id: string };
    return {
      ...row,
      student_submission_date: hasStudentSubmission
        ? ((row.student_submission_date as string | null | undefined) ?? null)
        : null,
      reminder_1_hindi: hasReminders
        ? ((row.reminder_1_hindi as string | null | undefined) ?? null)
        : null,
      reminder_2_biller: hasReminders
        ? ((row.reminder_2_biller as string | null | undefined) ?? null)
        : null,
      exam: examsBy[row.exam_id] ?? null,
    };
  });

  return NextResponse.json({ tracking });
}
