import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  assertTeacherAssignmentMatchesExam,
  fetchStudentIdsForTarget,
  isTeachingTrackId,
} from "@/lib/exams/logic";
import type { TeachingTrackType } from "@/lib/types/db";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { assertNoDuplicateExam } from "@/lib/validations/exams";
import type { ExamTargetType, GradeLevel } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { buildExamStudentRows } from "@/lib/exams/snapshots";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeLevel = parseGradeLevel(searchParams.get("grade_level") ?? "");
  const yearGroupRaw = searchParams.get("year_group");
  const yearGroup = yearGroupRaw ? Number.parseInt(yearGroupRaw, 10) : NaN;

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));

  let query = notDeleted(supabase.from("exams").select(`*, ${TEACHER_EMBED_IN_EXAM}`))
    .eq("academic_year_id", scope.year.id)
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (gradeLevel) query = query.eq("grade_level", gradeLevel);
  if (Number.isFinite(yearGroup)) query = query.eq("year_group", yearGroup);

  const { data, error } = await query;

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
    const row = e as { id: string; year_group: number; grade_level: GradeLevel };
    return {
      ...e,
      target_label: labels[row.id] ?? row.id,
      year_label: `שנתון ${row.year_group} — שכבה ${row.grade_level}`,
    };
  });

  return NextResponse.json({ exams: enriched, readOnly: scope.readOnly, academicYear: scope.year });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    target_type?: ExamTargetType;
    target_id?: string;
    year_group?: number;
    grade_level?: string;
    teacher_assignment_id?: string;
    lesson_name?: string | null;
    teaching_track_type?: TeachingTrackType | null;
  };

  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const exam_date = (body.exam_date ?? "").trim();
  const target_type = body.target_type;
  const target_id = (body.target_id ?? "").trim();
  const teacher_assignment_id = (body.teacher_assignment_id ?? "").trim();
  const year_group = Number(body.year_group);
  const grade_level = parseGradeLevel(String(body.grade_level ?? ""));

  if (!teacher_id || !subject || !exam_date || !target_type || !target_id) {
    return NextResponse.json({ error: "כל השדות חובה" }, { status: 400 });
  }
  if (!Number.isFinite(year_group) || !grade_level) {
    return NextResponse.json({ error: "שנתון ושכבה חובה" }, { status: 400 });
  }
  if (!["class", "specialization", "track", "psychology"].includes(target_type)) {
    return NextResponse.json({ error: "סוג יעד לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const yearScope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (yearScope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const resolvedTargetId = target_type === "psychology" ? yearScope.year.id : target_id;

  let teaching_track_type: TeachingTrackType | null =
    body.teaching_track_type === "full" || body.teaching_track_type === "short"
      ? body.teaching_track_type
      : null;

  const user = await getCurrentUser(supabase);

  const scope = {
    academic_year_id: yearScope.year.id,
    year_group,
    grade_level,
  };
  let assignmentId = teacher_assignment_id;
  let assignmentTeachingMode: "full" | "short" | null = null;

  if (assignmentId) {
    const { data: ta } = await supabase
      .from("teacher_assignments")
      .select("id, academic_year_id, year_group, grade_level, teacher_id, subject, target_type, target_id, teaching_mode")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!ta) return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 400 });
    if (ta.academic_year_id !== yearScope.year.id) {
      return NextResponse.json({ error: "שיבוץ לא שייך לשנה הנוכחית" }, { status: 400 });
    }
    if (ta.year_group !== year_group || ta.grade_level !== grade_level) {
      return NextResponse.json({ error: "שיבוץ לא תואם לשנתון/שכבה" }, { status: 400 });
    }
    if (ta.teacher_id !== teacher_id || ta.subject !== subject) {
      return NextResponse.json({ error: "שיבוץ לא תואם למורה/מקצוע" }, { status: 400 });
    }
    assignmentTeachingMode = (ta.teaching_mode as "full" | "short" | null) ?? null;
  } else {
    let assignmentQuery = supabase
      .from("teacher_assignments")
      .select("id, teaching_mode, lesson_name")
      .eq("teacher_id", teacher_id)
      .eq("subject", subject)
      .eq("academic_year_id", yearScope.year.id)
      .eq("target_type", target_type)
      .eq("target_id", resolvedTargetId)
      .eq("year_group", year_group)
      .eq("grade_level", grade_level)
      .is("deleted_at", null);
    const lessonFilter = (body as { lesson_name?: string }).lesson_name?.trim();
    if (lessonFilter) {
      assignmentQuery = assignmentQuery.eq("lesson_name", lessonFilter);
    }
    const { data: assignment } = await assignmentQuery.limit(1).maybeSingle();
    assignmentId = (assignment?.id as string) ?? "";
    assignmentTeachingMode = (assignment?.teaching_mode as "full" | "short" | null) ?? null;
  }

  if (!assignmentId) {
    return NextResponse.json({ error: "לא נמצא שיבוץ לשנתון/שכבה" }, { status: 400 });
  }

  const dup = await assertNoDuplicateExam(supabase, {
    yearGroup: year_group,
    gradeLevel: grade_level,
    teacherId: teacher_id,
    subject,
    targetType: target_type,
    targetId: resolvedTargetId,
    examDate: exam_date,
  });
  if (!dup.ok) return NextResponse.json({ error: dup.error }, { status: 400 });

  const check = await assertTeacherAssignmentMatchesExam(
    supabase,
    teacher_id,
    subject,
    target_type,
    resolvedTargetId,
    scope,
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  if (assignmentTeachingMode && !teaching_track_type) {
    teaching_track_type = assignmentTeachingMode;
  }

  if (target_type === "track") {
    const teachingTrack = await isTeachingTrackId(supabase, target_id);
    if (teachingTrack && !teaching_track_type) {
      return NextResponse.json({ error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" }, { status: 400 });
    }
    if (!teachingTrack) teaching_track_type = null;
  } else {
    teaching_track_type = null;
  }

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForTarget(
    supabase,
    target_type,
    resolvedTargetId,
    scope,
    { teachingTrackType: teaching_track_type },
  );
  if (stErr) return NextResponse.json({ error: stErr }, { status: 500 });
  if (!studentIds.length) {
    return NextResponse.json({ error: "לא נמצאו תלמידות לפי היעד ושנתון/שכבה" }, { status: 400 });
  }

  const insertRow: Record<string, unknown> = {
    academic_year_id: yearScope.year.id,
    teacher_id,
    subject,
    exam_date,
    target_type,
    target_id: resolvedTargetId,
    year_group,
    grade_level,
    teacher_assignment_id: assignmentId,
  };
  if (teaching_track_type) insertRow.teaching_track_type = teaching_track_type;

  const { data: exam, error: eErr } = await supabase.from("exams").insert(insertRow).select("*").single();

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

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("first_name, last_name, full_name_generated")
    .eq("id", teacher_id)
    .single();
  const teacherName = teacherEmbedDisplayName(teacherRow);

  const targetLabels = await resolveExamTargetLabels(supabase, [
    { id: examId, target_type, target_id: resolvedTargetId },
  ]);

  const rows = await buildExamStudentRows(supabase, {
    examId,
    studentIds,
    teacherName,
    subject,
    yearGroup: year_group,
    gradeLevel: grade_level,
    academicYearName: yearScope.year.year_name,
    targetName: targetLabels[examId] ?? null,
  });

  const { error: esErr } = await supabase.from("exam_students").insert(rows);
  if (esErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return NextResponse.json({ error: esErr.message }, { status: 400 });
  }

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam",
    entityId: examId,
    actionType: "create",
    entityNameSnapshot: subject,
    newValue: {
      teacher_id,
      subject,
      exam_date,
      target_type,
      target_id,
      year_group,
      grade_level,
      teacher_assignment_id: assignmentId,
    },
  });

  return NextResponse.json({ exam, students_count: studentIds.length });
}
