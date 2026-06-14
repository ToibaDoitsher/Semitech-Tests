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

  const SELECT_WITH_FIELDS =
    "id, status, created_at, completed_at, grade, student_id, exam_id, notes, auto_registered, starting_grade, is_paid";
  const SELECT_WITH_AUTO =
    "id, status, created_at, completed_at, grade, student_id, exam_id, notes, auto_registered";
  const SELECT_LEGACY =
    "id, status, created_at, completed_at, grade, student_id, exam_id, notes";

  const first = await supabase
    .from("makeup_exams")
    .select(SELECT_WITH_FIELDS)
    .eq("academic_year_id", scope.year.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let rows: Array<Record<string, unknown>> | null = (first.data ?? null) as
    | Array<Record<string, unknown>>
    | null;
  let error = first.error;

  if (error && /starting_grade|is_paid/i.test(error.message)) {
    const mid = await supabase
      .from("makeup_exams")
      .select(SELECT_WITH_AUTO)
      .eq("academic_year_id", scope.year.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = (mid.data ?? null) as Array<Record<string, unknown>> | null;
    error = mid.error;
  }

  if (error && /auto_registered/i.test(error.message)) {
    const legacy = await supabase
      .from("makeup_exams")
      .select(SELECT_LEGACY)
      .eq("academic_year_id", scope.year.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    rows = (legacy.data ?? null) as Array<Record<string, unknown>> | null;
    error = legacy.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = [...new Set((rows ?? []).map((r) => r.student_id as string))];
  const examIds = [...new Set((rows ?? []).map((r) => r.exam_id as string))];

  const studentsBy: Record<
    string,
    { first_name: string; last_name: string; tz: string; grade_level: string | null }
  > = {};
  const examsBy: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> = {};

  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select("id, first_name, last_name, tz, grade_level")
      .in("id", studentIds);
    for (const s of studs ?? []) {
      const row = s as {
        id: string;
        first_name: string;
        last_name: string;
        tz: string;
        grade_level: string | null;
      };
      studentsBy[row.id] = {
        first_name: row.first_name,
        last_name: row.last_name,
        tz: row.tz,
        grade_level: row.grade_level,
      };
    }
  }

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

  const makeups = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown> & { student_id: string; exam_id: string };
    const rawGrade = row.starting_grade;
    return {
      ...row,
      auto_registered: Boolean(row.auto_registered),
      starting_grade:
        rawGrade === null || rawGrade === undefined ? null : Number(rawGrade),
      is_paid: Boolean(row.is_paid),
      student: studentsBy[row.student_id] ?? null,
      exam: examsBy[row.exam_id] ?? null,
    };
  });

  return NextResponse.json({ makeups });
}
