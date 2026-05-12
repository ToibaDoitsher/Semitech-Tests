import { NextResponse } from "next/server";
import { assertTeacherAssignmentMatchesExam, fetchStudentIdsForTarget } from "@/lib/exams/logic";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import type { ExamTargetType } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*, teachers(name)")
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const exams = data ?? [];
  const labels = await resolveExamTargetLabels(
    supabase,
    exams.map((e) => ({
      id: (e as { id: string }).id,
      target_type: (e as { target_type: ExamTargetType }).target_type,
      target_id: (e as { target_id: string }).target_id,
    })),
  );

  const enriched = exams.map((e) => {
    const row = e as { id: string };
    return { ...e, target_label: labels[row.id] ?? row.id };
  });

  return NextResponse.json({ exams: enriched });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    target_type?: ExamTargetType;
    target_id?: string;
  };

  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const exam_date = (body.exam_date ?? "").trim();
  const target_type = body.target_type;
  const target_id = (body.target_id ?? "").trim();

  if (!teacher_id || !subject || !exam_date || !target_type || !target_id) {
    return NextResponse.json({ error: "כל השדות חובה" }, { status: 400 });
  }
  if (!["class", "specialization", "track"].includes(target_type)) {
    return NextResponse.json({ error: "סוג יעד לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const check = await assertTeacherAssignmentMatchesExam(
    supabase,
    teacher_id,
    subject,
    target_type,
    target_id,
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForTarget(supabase, target_type, target_id);
  if (stErr) return NextResponse.json({ error: stErr }, { status: 500 });
  if (!studentIds.length) {
    return NextResponse.json({ error: "לא נמצאו תלמידות לפי היעד שנבחר" }, { status: 400 });
  }

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .insert({
      teacher_id,
      subject,
      exam_date,
      target_type,
      target_id,
    })
    .select("*")
    .single();

  if (eErr || !exam) {
    return NextResponse.json({ error: eErr?.message ?? "שגיאה ביצירת מבחן" }, { status: 400 });
  }

  const examId = exam.id as string;

  const { error: trErr } = await supabase.from("exam_tracking").insert({
    exam_id: examId,
    teacher_id,
  });
  if (trErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return NextResponse.json({ error: trErr.message }, { status: 400 });
  }

  const rows = studentIds.map((student_id) => ({
    exam_id: examId,
    student_id,
    status: "pending" as const,
  }));

  const { error: esErr } = await supabase.from("exam_students").insert(rows);
  if (esErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return NextResponse.json({ error: esErr.message }, { status: 400 });
  }

  return NextResponse.json({ exam, students_count: studentIds.length });
}
