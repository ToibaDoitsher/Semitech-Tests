import { NextResponse } from "next/server";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import type { ExamTargetType } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Counts = {
  total: number;
  pending: number;
  took: number;
  missing: number;
  makeup: number;
  completed: number;
};

function emptyCounts(): Counts {
  return { total: 0, pending: 0, took: 0, missing: 0, makeup: 0, completed: 0 };
}

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function colorsForExam(
  examDate: string,
  c: Counts,
  tracking: {
    grades_submitted: boolean;
    submitted_exam: string | null;
  } | null,
): { backgroundColor: string; borderColor: string; textColor: string; tone: string } {
  const today = todayISODate();
  if (examDate > today) {
    return { backgroundColor: "#f4f4f5", borderColor: "#d4d4d8", textColor: "#3f3f46", tone: "future" };
  }
  if (c.total === 0) {
    return { backgroundColor: "#fecaca", borderColor: "#dc2626", textColor: "#7f1d1d", tone: "problem" };
  }

  const pastProblem =
    examDate < today &&
    (c.missing > 0 || !tracking?.grades_submitted || !tracking?.submitted_exam);
  if (pastProblem) {
    return { backgroundColor: "#fecaca", borderColor: "#b91c1c", textColor: "#7f1d1d", tone: "problem" };
  }

  if (c.completed === c.total && c.total > 0) {
    return { backgroundColor: "#bae6fd", borderColor: "#0284c7", textColor: "#0c4a6e", tone: "completed" };
  }
  if (c.took === c.total) {
    return { backgroundColor: "#bbf7d0", borderColor: "#16a34a", textColor: "#14532d", tone: "took" };
  }
  if (c.makeup > 0 || c.missing > 0) {
    return { backgroundColor: "#fef9c3", borderColor: "#ca8a04", textColor: "#713f12", tone: "makeup" };
  }
  if (c.pending === c.total) {
    return { backgroundColor: "#e4e4e7", borderColor: "#a1a1aa", textColor: "#3f3f46", tone: "pending" };
  }
  return { backgroundColor: "#e4e4e7", borderColor: "#71717a", textColor: "#27272a", tone: "mixed" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = (searchParams.get("start") ?? "").trim();
  const end = (searchParams.get("end") ?? "").trim();
  if (!start || !end) {
    return NextResponse.json({ error: "חובה start ו-end בפורמט YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: examsRaw, error: eErr } = await supabase
    .from("exams")
    .select("id, subject, exam_date, target_type, target_id, teacher_id, teachers(name)")
    .gte("exam_date", start)
    .lte("exam_date", end);

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  const exams = (examsRaw ?? []) as {
    id: string;
    subject: string;
    exam_date: string;
    target_type: ExamTargetType;
    target_id: string;
    teacher_id: string;
    teachers: { name: string } | { name: string }[] | null;
  }[];

  const examIds = exams.map((e) => e.id);
  const teacherIds = [...new Set(exams.map((e) => e.teacher_id))];

  const labels = await resolveExamTargetLabels(
    supabase,
    exams.map((e) => ({ id: e.id, target_type: e.target_type, target_id: e.target_id })),
  );

  let countsByExam: Record<string, Counts> = {};
  if (examIds.length) {
    const { data: lines, error: lErr } = await supabase
      .from("exam_students")
      .select("exam_id, status")
      .in("exam_id", examIds);
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
    for (const id of examIds) countsByExam[id] = emptyCounts();
    for (const row of lines ?? []) {
      const ex = (row as { exam_id: string; status: string }).exam_id;
      const st = (row as { exam_id: string; status: string }).status;
      if (!countsByExam[ex]) countsByExam[ex] = emptyCounts();
      const c = countsByExam[ex];
      c.total += 1;
      if (st === "pending") c.pending += 1;
      else if (st === "took") c.took += 1;
      else if (st === "missing") c.missing += 1;
      else if (st === "makeup") c.makeup += 1;
      else if (st === "completed") c.completed += 1;
    }
  }

  let trackingByExam: Record<
    string,
    {
      grades_submitted: boolean;
      submitted_exam: string | null;
    }
  > = {};
  if (examIds.length) {
    const { data: tr, error: tErr } = await supabase
      .from("exam_tracking")
      .select("exam_id, grades_submitted, submitted_exam")
      .in("exam_id", examIds);
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
    for (const r of tr ?? []) {
      const row = r as { exam_id: string; grades_submitted: boolean; submitted_exam: string | null };
      trackingByExam[row.exam_id] = {
        grades_submitted: row.grades_submitted,
        submitted_exam: row.submitted_exam,
      };
    }
  }

  const assignKey = (teacher_id: string, subject: string, target_type: ExamTargetType, target_id: string) =>
    `${teacher_id}|${subject.trim().toLowerCase()}|${target_type}|${target_id}`;

  const gradeByAssignKey = new Map<string, string>();
  if (teacherIds.length) {
    const { data: assigns, error: aErr } = await supabase
      .from("teacher_assignments")
      .select("teacher_id, subject, target_type, target_id, grade_level_id")
      .in("teacher_id", teacherIds)
      .eq("active", true);
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
    for (const a of assigns ?? []) {
      const row = a as {
        teacher_id: string;
        subject: string;
        target_type: ExamTargetType;
        target_id: string;
        grade_level_id: string;
      };
      gradeByAssignKey.set(assignKey(row.teacher_id, row.subject, row.target_type, row.target_id), row.grade_level_id);
    }
  }

  const usedGradeIds = [...new Set([...gradeByAssignKey.values()])].filter(Boolean);
  const gradeNameById: Record<string, string> = {};
  if (usedGradeIds.length) {
    const { data: glv, error: glErr } = await supabase
      .from("grade_levels")
      .select("id,name")
      .in("id", usedGradeIds);
    if (glErr) return NextResponse.json({ error: glErr.message }, { status: 500 });
    for (const r of glv ?? []) {
      const row = r as { id: string; name: string };
      gradeNameById[row.id] = row.name;
    }
  }

  const classDayKey = (date: string, classId: string) => `${date}|${classId}`;
  const classDayCount = new Map<string, number>();
  for (const e of exams) {
    if (e.target_type === "class") {
      const k = classDayKey(e.exam_date, e.target_id);
      classDayCount.set(k, (classDayCount.get(k) ?? 0) + 1);
    }
  }

  const dayExamCount = new Map<string, number>();
  for (const e of exams) {
    dayExamCount.set(e.exam_date, (dayExamCount.get(e.exam_date) ?? 0) + 1);
  }

  const events = exams.map((e) => {
    const c = countsByExam[e.id] ?? emptyCounts();
    const tr = trackingByExam[e.id] ?? null;
    const cols = colorsForExam(e.exam_date, c, tr);
    const tn = e.teachers;
    const teacherName = Array.isArray(tn) ? tn[0]?.name : tn && typeof tn === "object" && "name" in tn ? tn.name : "";
    const gk = assignKey(e.teacher_id, e.subject, e.target_type, e.target_id);
    const gradeLevelId = gradeByAssignKey.get(gk) ?? null;
    const gradeLevelName = gradeLevelId ? gradeNameById[gradeLevelId] ?? null : null;
    const classConflict =
      e.target_type === "class" && (classDayCount.get(classDayKey(e.exam_date, e.target_id)) ?? 0) > 1;
    const dayLoad = dayExamCount.get(e.exam_date) ?? 0;

    const targetTypeHe: Record<string, string> = {
      class: "כיתה",
      specialization: "התמחות",
      track: "מסלול",
    };

    const shortCounts = c.total ? `${c.took + c.completed}/${c.total}` : "0";

    return {
      id: e.id,
      title: `${e.subject} · ${teacherName ?? ""} (${shortCounts})`.trim(),
      start: e.exam_date,
      allDay: true,
      backgroundColor: cols.backgroundColor,
      borderColor: cols.borderColor,
      textColor: cols.textColor,
      extendedProps: {
        examId: e.id,
        subject: e.subject,
        examDate: e.exam_date,
        teacherId: e.teacher_id,
        teacherName: teacherName ?? "",
        targetType: e.target_type,
        targetTypeLabel: targetTypeHe[e.target_type] ?? e.target_type,
        targetId: e.target_id,
        targetLabel: labels[e.id] ?? e.target_id,
        gradeLevelId,
        gradeLevelName,
        counts: c,
        tone: cols.tone,
        classConflict,
        dayExamCount: dayLoad,
        heavyDay: dayLoad > 5,
        tracking: tr,
      },
    };
  });

  return NextResponse.json({ events, dayExamCount: Object.fromEntries(dayExamCount) });
}
