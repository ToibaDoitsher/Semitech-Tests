import { NextResponse } from "next/server";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const examDateFrom = searchParams.get("exam_date_from")?.trim();
  const examDateTo = searchParams.get("exam_date_to")?.trim();
  const hasGrade = searchParams.get("has_grade");
  const completed = searchParams.get("completed");

  const supabase = createSupabaseAdminClient();

  let q = supabase
    .from("makeup_tracking")
    .select(
      "id, exam_id, teacher_id, student_id, sent_to_teacher_at, grade_received_at, grade, makeup_exam_id",
    );

  if (teacherId) q = q.eq("teacher_id", teacherId);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examIds = [...new Set((rows ?? []).map((r) => r.exam_id as string))];
  if (!examIds.length) return NextResponse.json({ groups: [] });

  const { data: exams } = await supabase
    .from("exams")
    .select(`id, subject, exam_date, teacher_id, ${TEACHER_EMBED_IN_EXAM}`)
    .in("id", examIds);

  const examsBy = new Map(
    (exams ?? []).map((e) => {
      const raw = e as {
        id: string;
        subject: string;
        exam_date: string;
        teacher_id: string;
        teachers: unknown;
      };
      return [
        raw.id,
        {
          subject: raw.subject,
          exam_date: raw.exam_date,
          teacher_id: raw.teacher_id,
          teacher_name:
            teacherEmbedDisplayName(
              raw.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
            ) || null,
        },
      ] as const;
    }),
  );

  const makeupIds = (rows ?? [])
    .map((r) => r.makeup_exam_id as string | null)
    .filter((id): id is string => Boolean(id));
  const makeupStatusBy = new Map<string, string>();
  if (makeupIds.length) {
    const { data: makeups } = await supabase
      .from("makeup_exams")
      .select("id, status")
      .in("id", makeupIds);
    for (const m of makeups ?? []) {
      makeupStatusBy.set(m.id as string, m.status as string);
    }
  }

  type GroupAcc = {
    exam_id: string;
    teacher_id: string;
    teacher_name: string | null;
    subject: string;
    exam_date: string;
    count: number;
    open_count: number;
    with_grade_count: number;
    sent_count: number;
  };

  const groups = new Map<string, GroupAcc>();

  for (const r of rows ?? []) {
    const exam = examsBy.get(r.exam_id as string);
    if (!exam) continue;
    if (subject && !exam.subject.includes(subject)) continue;
    if (examDateFrom && exam.exam_date < examDateFrom) continue;
    if (examDateTo && exam.exam_date > examDateTo) continue;

    const makeupStatus = r.makeup_exam_id
      ? makeupStatusBy.get(r.makeup_exam_id as string) ?? "open"
      : "open";
    const isCompleted = makeupStatus === "completed";
    if (completed === "true" && !isCompleted) continue;
    if (completed === "false" && isCompleted) continue;

    const hasGradeVal = r.grade !== null && r.grade !== undefined;
    if (hasGrade === "true" && !hasGradeVal) continue;
    if (hasGrade === "false" && hasGradeVal) continue;

    const key = `${r.exam_id}\0${r.teacher_id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        exam_id: r.exam_id as string,
        teacher_id: r.teacher_id as string,
        teacher_name: exam.teacher_name,
        subject: exam.subject,
        exam_date: exam.exam_date,
        count: 0,
        open_count: 0,
        with_grade_count: 0,
        sent_count: 0,
      };
      groups.set(key, g);
    }
    g.count += 1;
    if (!isCompleted) g.open_count += 1;
    if (hasGradeVal) g.with_grade_count += 1;
    if (r.sent_to_teacher_at) g.sent_count += 1;
  }

  const list = [...groups.values()].sort((a, b) => b.exam_date.localeCompare(a.exam_date));

  return NextResponse.json({ groups: list });
}
