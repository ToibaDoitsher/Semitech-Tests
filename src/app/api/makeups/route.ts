import { NextResponse } from "next/server";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("makeup_exams")
    .select("id, status, created_at, completed_at, grade, student_id, exam_id")
    .eq("status", "open")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = [...new Set((rows ?? []).map((r) => r.student_id))];
  const examIds = [...new Set((rows ?? []).map((r) => r.exam_id))];

  let studentsBy: Record<string, { first_name: string; last_name: string; tz: string }> = {};
  let examsBy: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> = {};

  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select("id, first_name, last_name, tz")
      .in("id", studentIds);
    for (const s of studs ?? []) {
      const row = s as { id: string; first_name: string; last_name: string; tz: string };
      studentsBy[row.id] = {
        first_name: row.first_name,
        last_name: row.last_name,
        tz: row.tz,
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

  const makeups = (rows ?? []).map((r) => ({
    ...r,
    student: studentsBy[r.student_id] ?? null,
    exam: examsBy[r.exam_id] ?? null,
  }));

  return NextResponse.json({ makeups });
}
