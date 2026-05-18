import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import {
  assertTeacherAssignmentMatchesExam,
  fetchStudentIdsForTarget,
  isTeachingTrackId,
  targetColumnsFromAssignment,
} from "@/lib/exams/logic";
import {
  normalizeTargetInput,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import type { AssignmentCategory } from "@/lib/types/db";
import type { TeachingTrackType } from "@/lib/types/db";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { assertNoDuplicateExam } from "@/lib/validations/exams";
import type { GradeLevel } from "@/lib/types/db";
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
    exams.map((e) => {
      const row = e as {
        id: string;
        class_id: string | null;
        specialization_id: string | null;
        track_id: string | null;
        psychology_enabled: boolean;
      };
      return {
        id: row.id,
        class_id: row.class_id,
        specialization_id: row.specialization_id,
        track_id: row.track_id,
        psychology_enabled: row.psychology_enabled,
      };
    }),
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
    year_group?: number;
    grade_level?: string;
    teacher_assignment_id?: string;
    class_id?: string | null;
    specialization_id?: string | null;
    track_id?: string | null;
    psychology_enabled?: boolean;
    lesson_name?: string | null;
    teaching_track_type?: TeachingTrackType | null;
  };

  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const exam_date = (body.exam_date ?? "").trim();
  const teacher_assignment_id = (body.teacher_assignment_id ?? "").trim();
  const year_group = Number(body.year_group);
  const grade_level = parseGradeLevel(String(body.grade_level ?? ""));

  if (!teacher_id || !subject || !exam_date) {
    return NextResponse.json({ error: "כל השדות חובה" }, { status: 400 });
  }
  if (!Number.isFinite(year_group) || !grade_level) {
    return NextResponse.json({ error: "שנתון ושכבה חובה" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const yearScope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (yearScope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  let examCategory: AssignmentCategory = "חובה";
  let examTarget = normalizeTargetInput({
    class_id: body.class_id,
    specialization_id: body.specialization_id,
    track_id: body.track_id,
    psychology_enabled: body.psychology_enabled,
  });

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
      .select(
        "id, academic_year_id, year_group, grade_level, teacher_id, subject, assignment_category, class_id, specialization_id, track_id, psychology_enabled, teaching_mode",
      )
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
    examTarget = targetColumnsFromAssignment(ta);
    examCategory = ta.assignment_category as AssignmentCategory;
    assignmentTeachingMode = (ta.teaching_mode as "full" | "short" | null) ?? null;
  } else {
    let assignmentQuery = supabase
      .from("teacher_assignments")
      .select(
        "id, assignment_category, class_id, specialization_id, track_id, psychology_enabled, teaching_mode, lesson_name",
      )
      .eq("teacher_id", teacher_id)
      .eq("subject", subject)
      .eq("academic_year_id", yearScope.year.id)
      .eq("year_group", year_group)
      .eq("grade_level", grade_level)
      .is("deleted_at", null);

    if (examTarget.psychology_enabled) {
      assignmentQuery = assignmentQuery.eq("assignment_category", "חובה").eq("psychology_enabled", true);
    } else if (examTarget.class_id) {
      assignmentQuery = assignmentQuery.eq("assignment_category", "חובה").eq("class_id", examTarget.class_id);
    } else if (examTarget.specialization_id) {
      assignmentQuery = assignmentQuery
        .eq("assignment_category", "התמחות")
        .eq("specialization_id", examTarget.specialization_id);
    } else if (examTarget.track_id) {
      assignmentQuery = assignmentQuery.eq("assignment_category", "חובה").eq("track_id", examTarget.track_id);
    }

    const lessonFilter = body.lesson_name?.trim();
    if (lessonFilter) assignmentQuery = assignmentQuery.eq("lesson_name", lessonFilter);

    const { data: assignment } = await assignmentQuery.limit(1).maybeSingle();
    assignmentId = (assignment?.id as string) ?? "";
    if (assignment?.assignment_category) {
      examCategory = assignment.assignment_category as AssignmentCategory;
      examTarget = targetColumnsFromAssignment(assignment);
    }
    assignmentTeachingMode = (assignment?.teaching_mode as "full" | "short" | null) ?? null;
  }

  if (!assignmentId) {
    return NextResponse.json({ error: "לא נמצא שיבוץ לשנתון/שכבה" }, { status: 400 });
  }

  const targetErr = validateAssignmentWithCategory(examCategory, examTarget);
  if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

  const dup = await assertNoDuplicateExam(supabase, {
    yearGroup: year_group,
    gradeLevel: grade_level,
    teacherId: teacher_id,
    subject,
    target: examTarget,
    examDate: exam_date,
  });
  if (!dup.ok) return NextResponse.json({ error: dup.error }, { status: 400 });

  const check = await assertTeacherAssignmentMatchesExam(
    supabase,
    teacher_id,
    subject,
    examTarget,
    scope,
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  if (assignmentTeachingMode && !teaching_track_type) {
    teaching_track_type = assignmentTeachingMode;
  }

  if (examTarget.track_id) {
    const teachingTrack = await isTeachingTrackId(supabase, examTarget.track_id);
    if (teachingTrack && !teaching_track_type) {
      return NextResponse.json({ error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" }, { status: 400 });
    }
    if (!teachingTrack) teaching_track_type = null;
  } else {
    teaching_track_type = null;
  }

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForTarget(
    supabase,
    examTarget,
    scope,
    { teachingTrackType: teaching_track_type, category: examCategory },
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
    assignment_category: examCategory,
    class_id: examTarget.class_id,
    specialization_id: examTarget.specialization_id,
    track_id: examTarget.track_id,
    psychology_enabled: examTarget.psychology_enabled,
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
    { id: examId, ...examTarget },
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
      ...examTarget,
      year_group,
      grade_level,
      teacher_assignment_id: assignmentId,
    },
  });

  return NextResponse.json({ exam, students_count: studentIds.length });
}
