import { enrichStudentsWithGradeForYear } from "@/lib/academic/studentGrade.server";
import { asStudentRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type { ExamStudentStatus, MakeupExamStatus } from "@/lib/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentCardExamRow = {
  id: string;
  status: ExamStudentStatus;
  updated_at: string;
  exam_id: string;
  exam: { subject: string; exam_date: string; teacher_name: string | null } | null;
};

export type StudentCardMakeupRow = {
  id: string;
  status: MakeupExamStatus;
  created_at: string;
  completed_at: string | null;
  grade: number | null;
  exam_id: string;
  exam: { subject: string; exam_date: string } | null;
};

export type StudentCardData = {
  student: Awaited<ReturnType<typeof enrichStudentsWithGradeForYear>>[number] & {
    first_name: string;
    last_name: string;
    tz: string;
  };
  exam_students: StudentCardExamRow[];
  makeups: StudentCardMakeupRow[];
};

export async function loadStudentCardData(
  supabase: SupabaseClient,
  studentId: string,
): Promise<StudentCardData | null> {
  const studentSelect = await getStudentWithLookupsSelect();
  const { data: student, error: sErr } = await supabase
    .from("students")
    .select(studentSelect)
    .eq("id", studentId)
    .single();
  if (sErr || !student) return null;

  const row = asStudentRow(student);
  const enriched = (await enrichStudentsWithGradeForYear(supabase, [row]))[0];

  const { data: examStudents } = await supabase
    .from("exam_students")
    .select("id, status, updated_at, exam_id")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  const examIds = [...new Set((examStudents ?? []).map((r) => r.exam_id as string))];
  const examsMeta: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> =
    {};

  if (examIds.length) {
    const { data: exams } = await supabase
      .from("exams")
      .select(`id, subject, exam_date, ${TEACHER_EMBED_IN_EXAM}`)
      .in("id", examIds);
    for (const e of exams ?? []) {
      const raw = e as { id: string; subject: string; exam_date: string; teachers: unknown };
      examsMeta[raw.id] = {
        subject: raw.subject,
        exam_date: raw.exam_date,
        teacher_name:
          teacherEmbedDisplayName(
            raw.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
          ) || null,
      };
    }
  }

  const exam_students: StudentCardExamRow[] = (examStudents ?? []).map((es) => ({
    id: es.id as string,
    status: es.status as ExamStudentStatus,
    updated_at: es.updated_at as string,
    exam_id: es.exam_id as string,
    exam: examsMeta[es.exam_id as string] ?? null,
  }));

  const { data: makeups } = await supabase
    .from("makeup_exams")
    .select("id, status, created_at, completed_at, grade, exam_id")
    .eq("student_id", studentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const makeupExamIds = [...new Set((makeups ?? []).map((m) => m.exam_id as string))];
  const makeupExamsMeta: Record<string, { subject: string; exam_date: string }> = {};
  if (makeupExamIds.length) {
    const { data: mex } = await supabase
      .from("exams")
      .select("id, subject, exam_date")
      .in("id", makeupExamIds);
    for (const e of mex ?? []) {
      const raw = e as { id: string; subject: string; exam_date: string };
      makeupExamsMeta[raw.id] = { subject: raw.subject, exam_date: raw.exam_date };
    }
  }

  const makeupsEnriched: StudentCardMakeupRow[] = (makeups ?? []).map((m) => ({
    id: m.id as string,
    status: m.status as MakeupExamStatus,
    created_at: m.created_at as string,
    completed_at: (m.completed_at as string | null) ?? null,
    grade: (m.grade as number | null) ?? null,
    exam_id: m.exam_id as string,
    exam: makeupExamsMeta[m.exam_id as string] ?? null,
  }));

  return {
    student: enriched as StudentCardData["student"],
    exam_students,
    makeups: makeupsEnriched,
  };
}
