import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { normalizeSubjectLessonFields } from "@/lib/assignments/excelImport";
import { findOrCreateAssignment } from "@/lib/assignments/findOrCreate";
import {
  normalizeTargetInput,
  parseAssignmentCategory,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import { createOneExam } from "@/lib/exams/createOneExam";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { resolveTeacherAssignmentForGrade } from "@/lib/exams/resolveAssignmentForGrade";
import { getGradeLevelOptionById } from "@/lib/gradeLevels/options";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import type { AssignmentCategory, GradeLevel, TeachingTrackType } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { formatGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type NewAssignmentBody = {
  subject?: string;
  lesson_name?: string | null;
  assignment_category?: string;
  class_id?: string | null;
  specialization_id?: string | null;
  track_id?: string | null;
  psychology_enabled?: boolean;
  teaching_mode?: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeLevel = parseGradeLevel(searchParams.get("grade_level") ?? "");

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));

  let query = notDeleted(supabase.from("exams").select(`*, ${TEACHER_EMBED_IN_EXAM}`))
    .eq("academic_year_id", scope.year.id)
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (gradeLevel) query = query.eq("grade_level", gradeLevel);

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
    const row = e as { id: string; grade_level: GradeLevel };
    return {
      ...e,
      target_label: labels[row.id] ?? row.id,
      year_label: formatGradeLabel(row.grade_level),
    };
  });

  return NextResponse.json({ exams: enriched, readOnly: scope.readOnly, academicYear: scope.year });
}

async function resolveGradeLevelsFromBody(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  body: {
    grade_level?: string;
    grade_level_option_id?: string;
    grade_level_option_ids?: string[];
  },
): Promise<{ gradeLevels: GradeLevel[] } | { error: string }> {
  const optionIds = [
    ...(body.grade_level_option_ids ?? []).map((id) => id.trim()).filter(Boolean),
    ...(body.grade_level_option_id?.trim() ? [body.grade_level_option_id.trim()] : []),
  ];
  const uniqueOptionIds = [...new Set(optionIds)];

  if (uniqueOptionIds.length) {
    const gradeLevels: GradeLevel[] = [];
    for (const optionId of uniqueOptionIds) {
      const opt = await getGradeLevelOptionById(supabase, optionId);
      if (!opt?.is_active) {
        return { error: `אפשרות שכבה לא נמצאה (${optionId})` };
      }
      gradeLevels.push(...opt.grade_levels);
    }
    const unique = [...new Set(gradeLevels)];
    if (!unique.length) return { error: "בחרי לפחות שכבה אחת" };
    return { gradeLevels: unique };
  }

  const gl = parseGradeLevel(String(body.grade_level ?? ""));
  if (!gl) return { error: "בחרי שכבה" };
  return { gradeLevels: [gl] };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    grade_level?: string;
    grade_level_option_id?: string;
    grade_level_option_ids?: string[];
    teacher_assignment_id?: string;
    new_assignment?: NewAssignmentBody;
    teaching_track_type?: TeachingTrackType | null;
  };

  const teacher_id = body.teacher_id?.trim();
  const exam_date = (body.exam_date ?? "").trim();
  const teacher_assignment_id = (body.teacher_assignment_id ?? "").trim();
  const newAssignmentRaw = body.new_assignment;

  if (!teacher_id || !exam_date) {
    return NextResponse.json({ error: "מורה ותאריך חובה" }, { status: 400 });
  }

  const useNewAssignment = Boolean(newAssignmentRaw);
  if (!useNewAssignment && !teacher_assignment_id) {
    return NextResponse.json({ error: "בחרי שיבוץ קיים או מלאי פרטי שיבוץ חדש" }, { status: 400 });
  }
  if (useNewAssignment && teacher_assignment_id) {
    return NextResponse.json({ error: "לא ניתן לשלוח גם שיבוץ קיים וגם שיבוץ חדש" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const yearScope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (yearScope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const gradeResolved = await resolveGradeLevelsFromBody(supabase, body);
  if ("error" in gradeResolved) {
    return NextResponse.json({ error: gradeResolved.error }, { status: 400 });
  }
  const gradeLevels = gradeResolved.gradeLevels;

  const teaching_track_type: TeachingTrackType | null =
    body.teaching_track_type === "full" || body.teaching_track_type === "short"
      ? body.teaching_track_type
      : null;

  const user = await getCurrentUser(supabase);
  const created: {
    exam: Record<string, unknown>;
    students_count: number;
    grade_level: GradeLevel;
    assignments_created?: number;
  }[] = [];
  let assignmentsCreated = 0;

  if (useNewAssignment && newAssignmentRaw) {
    const subjectLesson = normalizeSubjectLessonFields(
      newAssignmentRaw.subject ?? "",
      newAssignmentRaw.lesson_name ?? "",
    );
    if (subjectLesson.error) {
      return NextResponse.json({ error: subjectLesson.error }, { status: 400 });
    }

    const category = parseAssignmentCategory(newAssignmentRaw.assignment_category ?? "");
    if (!category) {
      return NextResponse.json({ error: "בחרי סוג שיבוץ: חובה או התמחות" }, { status: 400 });
    }

    const target = normalizeTargetInput({
      class_id: newAssignmentRaw.class_id,
      specialization_id: newAssignmentRaw.specialization_id,
      track_id: newAssignmentRaw.track_id,
      psychology_enabled: newAssignmentRaw.psychology_enabled,
    });
    const targetErr = validateAssignmentWithCategory(category, target);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      category === "חובה" ? target.track_id : null,
      newAssignmentRaw.teaching_mode,
    );
    if (teaching.error) {
      return NextResponse.json({ error: teaching.error }, { status: 400 });
    }

    const subject = subjectLesson.subject;

    for (const gradeLevel of gradeLevels) {
      const resolved = await findOrCreateAssignment(supabase, yearScope.year.id, {
        teacher_id,
        grade_level: gradeLevel,
        subject,
        lesson_name: subjectLesson.lesson_name,
        assignment_category: category,
        class_id: target.class_id,
        specialization_id: target.specialization_id,
        track_id: target.track_id,
        psychology_enabled: target.psychology_enabled,
        teaching_mode: teaching.teaching_mode,
      });
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      if (resolved.created) assignmentsCreated += 1;

      const result = await createOneExam({
        supabase,
        academicYearId: yearScope.year.id,
        academicYearName: yearScope.year.year_name,
        teacherId: teacher_id,
        subject,
        examDate: exam_date,
        gradeLevel,
        assignmentId: resolved.id,
        teachingTrackType: teaching_track_type,
        auditUserId: user?.id ?? null,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      created.push({ ...result, grade_level: gradeLevel });
    }
  } else {
    const subject = (body.subject ?? "").trim();
    if (!subject) {
      return NextResponse.json({ error: "מקצוע חובה" }, { status: 400 });
    }

    const { data: templateTa, error: taLoadErr } = await supabase
      .from("teacher_assignments")
      .select(
        "id, grade_level, teacher_id, subject, assignment_category, class_id, specialization_id, track_id, psychology_enabled, lesson_name, teaching_mode",
      )
      .eq("id", teacher_assignment_id)
      .maybeSingle();
    if (taLoadErr) return NextResponse.json({ error: taLoadErr.message }, { status: 500 });
    if (!templateTa) return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 400 });
    if (templateTa.teacher_id !== teacher_id || templateTa.subject !== subject) {
      return NextResponse.json({ error: "שיבוץ לא תואם למורה/מקצוע" }, { status: 400 });
    }

    for (const gradeLevel of gradeLevels) {
      const resolved = await resolveTeacherAssignmentForGrade(
        supabase,
        yearScope.year.id,
        {
          id: templateTa.id as string,
          grade_level: templateTa.grade_level as GradeLevel,
          teacher_id: templateTa.teacher_id as string,
          subject: templateTa.subject as string,
          assignment_category: templateTa.assignment_category as AssignmentCategory,
          class_id: templateTa.class_id as string | null,
          specialization_id: templateTa.specialization_id as string | null,
          track_id: templateTa.track_id as string | null,
          psychology_enabled: templateTa.psychology_enabled as boolean,
          lesson_name: templateTa.lesson_name as string | null,
          teaching_mode: (templateTa.teaching_mode as "full" | "short" | null) ?? null,
        },
        gradeLevel,
      );
      if ("error" in resolved) {
        return NextResponse.json({ error: resolved.error }, { status: 400 });
      }
      if (resolved.created) assignmentsCreated += 1;

      const result = await createOneExam({
        supabase,
        academicYearId: yearScope.year.id,
        academicYearName: yearScope.year.year_name,
        teacherId: teacher_id,
        subject,
        examDate: exam_date,
        gradeLevel,
        assignmentId: resolved.id,
        teachingTrackType: teaching_track_type,
        auditUserId: user?.id ?? null,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      created.push({ ...result, grade_level: gradeLevel });
    }
  }

  const studentsTotal = created.reduce((s, c) => s + c.students_count, 0);

  return NextResponse.json({
    exam: created[0]?.exam,
    exams: created.map((c) => c.exam),
    students_count: studentsTotal,
    created_count: created.length,
    assignments_created: assignmentsCreated,
  });
}
