import { NextResponse } from "next/server";
import { examGradeLevelsLabel } from "@/lib/assignments/multiTarget";
import { resolveScopeFromUrl } from "@/lib/academicYears/scope";
import {
  backfillMakeupTrackingFromMakeups,
  makeupTrackingTableHint,
} from "@/lib/makeupTracking/sync";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ExamSummary = {
  subject: string;
  exam_date: string;
  teacher_id: string;
  grade_level: string;
  teacher_name: string | null;
};

type TrackingRow = {
  exam_id: string;
  teacher_id: string;
  makeup_exam_id: string | null;
  grade: number | null;
  sent_to_teacher_at: string | null;
};

async function loadExamsById(
  supabase: SupabaseClient,
  examIds: string[],
  academicYearId: string,
): Promise<{ examsBy: Map<string, ExamSummary> } | { error: string }> {
  const { data: exams, error } = await supabase
    .from("exams")
    .select(`id, subject, exam_date, teacher_id, grade_levels, ${TEACHER_EMBED_IN_EXAM}`)
    .in("id", examIds)
    .eq("academic_year_id", academicYearId);

  if (error) {
    return { error: makeupTrackingTableHint(error.message) };
  }

  const examsBy = new Map<string, ExamSummary>();
  for (const e of exams ?? []) {
    const raw = e as {
      id: string;
      subject: string;
      exam_date: string;
      teacher_id: string;
      grade_levels?: string[] | null;
      teachers: unknown;
    };
    examsBy.set(raw.id, {
      subject: raw.subject,
      exam_date: raw.exam_date,
      teacher_id: raw.teacher_id,
      grade_level: examGradeLevelsLabel(raw),
      teacher_name:
        teacherEmbedDisplayName(
          raw.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
        ) || null,
    });
  }

  return { examsBy };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id")?.trim();
  const subject = searchParams.get("subject")?.trim();
  const examDateFrom = searchParams.get("exam_date_from")?.trim();
  const examDateTo = searchParams.get("exam_date_to")?.trim();
  const hasGrade = searchParams.get("has_grade");
  const completed = searchParams.get("completed");
  const sync = searchParams.get("sync") === "1";

  const supabase = createSupabaseAdminClient();
  const scope = await resolveScopeFromUrl(supabase, searchParams);

  if (sync) {
    const backfill = await backfillMakeupTrackingFromMakeups(supabase, scope.year.id);
    if (backfill.error) {
      return NextResponse.json({ error: backfill.error }, { status: 500 });
    }
  }

  let q = supabase
    .from("makeup_tracking")
    .select(
      "id, exam_id, teacher_id, student_id, sent_to_teacher_at, grade_received_at, grade, makeup_exam_id",
    )
    .eq("academic_year_id", scope.year.id)
    .eq("term", scope.term);

  if (teacherId) q = q.eq("teacher_id", teacherId);

  const { data: rows, error } = await q;
  if (error) {
    return NextResponse.json({ error: makeupTrackingTableHint(error.message) }, { status: 500 });
  }

  const trackingRows = (rows ?? []) as TrackingRow[];
  const examIds = [...new Set(trackingRows.map((r) => r.exam_id))];
  if (!examIds.length) return NextResponse.json({ groups: [] });

  const loaded = await loadExamsById(supabase, examIds, scope.year.id);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error }, { status: 500 });
  }

  const makeupIds = trackingRows
    .map((r) => r.makeup_exam_id)
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
    grade_level: string;
    count: number;
    open_count: number;
    with_grade_count: number;
    sent_count: number;
  };

  const groups = new Map<string, GroupAcc>();

  for (const r of trackingRows) {
    const exam = loaded.examsBy.get(r.exam_id);
    if (!exam) continue;
    if (subject && !exam.subject.includes(subject)) continue;
    if (examDateFrom && exam.exam_date < examDateFrom) continue;
    if (examDateTo && exam.exam_date > examDateTo) continue;

    const makeupStatus = r.makeup_exam_id
      ? makeupStatusBy.get(r.makeup_exam_id) ?? "open"
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
        exam_id: r.exam_id,
        teacher_id: r.teacher_id,
        teacher_name: exam.teacher_name,
        subject: exam.subject,
        exam_date: exam.exam_date,
        grade_level: exam.grade_level,
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
