import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { normalizeSubjectLessonFields } from "@/lib/assignments/excelImport";
import { findOrCreateAssignment } from "@/lib/assignments/findOrCreate";
import {
  normalizeMultiTargetInput,
  rowToMultiTarget,
  validateMultiTarget,
} from "@/lib/assignments/multiTarget";
import { parseAssignmentCategory } from "@/lib/assignments/target";
import { createOneExam } from "@/lib/exams/createOneExam";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { resolveGradeLevelsFromRequest } from "@/lib/gradeLevels/options";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import { isTeachingModeSelection, isTeachingModeValue, isTeachingSelectionComplete, teachingModeToExamDb } from "@/lib/teachers/teachingMode";
import { isTeachingTrackName } from "@/lib/students/fields";
import type { AssignmentCategory, GradeLevel, TeachingMode, TeachingTrackType } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { formatGradeLevelsLabel } from "@/lib/assignments/multiTarget";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { TEACHER_EMBED_IN_EXAM } from "@/lib/teachers/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { filterGradeLevels } from "@/lib/gradeLevels/options";

export const dynamic = "force-dynamic";

type NewAssignmentBody = {
  subject?: string;
  lesson_name?: string | null;
  assignment_category?: string;
  grade_levels?: string[];
  class_ids?: string[];
  track_ids?: string[];
  specialization_ids?: string[];
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
  teaching_mode?: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gradeFilter = filterGradeLevels(
    searchParams.get("grade_level") ? [searchParams.get("grade_level")!] : [],
  );

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));

  let query = notDeleted(supabase.from("exams").select(`*, ${TEACHER_EMBED_IN_EXAM}`))
    .eq("academic_year_id", scope.year.id)
    .order("exam_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let exams = data ?? [];

  if (gradeFilter.length) {
    exams = exams.filter((e) => {
      const gl = (e as { grade_levels?: string[] }).grade_levels ?? [];
      return gradeFilter.some((g) => gl.includes(g));
    });
  }

  const labels = await resolveExamTargetLabels(
    supabase,
    exams.map((e) => {
      const row = e as {
        id: string;
        grade_levels: string[];
        class_ids: string[];
        track_ids: string[];
        specialization_ids: string[];
        psychology_enabled: boolean;
        applies_to_all_in_grade: boolean;
      };
      return { id: row.id, ...rowToMultiTarget(row) };
    }),
  );

  const enriched = exams.map((e) => {
    const row = e as { id: string; grade_levels: GradeLevel[] };
    return {
      ...e,
      target_label: labels[row.id] ?? row.id,
      year_label: formatGradeLevelsLabel(row.grade_levels ?? []),
    };
  });

  return NextResponse.json({ exams: enriched, readOnly: scope.readOnly, academicYear: scope.year });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    exam_date?: string;
    teacher_assignment_id?: string;
    new_assignment?: NewAssignmentBody;
    teaching_mode?: TeachingMode | null;
    /** @deprecated — שלחי teaching_mode */
    teaching_track_type?: TeachingMode | TeachingTrackType | null;
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

  const rawTeaching = body.teaching_mode ?? body.teaching_track_type;
  const teachingMode: TeachingMode | null = isTeachingModeValue(rawTeaching) ? rawTeaching : null;

  const user = await getCurrentUser(supabase);
  let assignmentId = teacher_assignment_id;
  let assignmentsCreated = 0;
  let subject = (body.subject ?? "").trim();

  if (useNewAssignment && newAssignmentRaw) {
    const subjectLesson = normalizeSubjectLessonFields(
      newAssignmentRaw.subject ?? "",
      newAssignmentRaw.lesson_name ?? "",
    );
    if (subjectLesson.error) {
      return NextResponse.json({ error: subjectLesson.error }, { status: 400 });
    }

    const parsedCategory = parseAssignmentCategory(newAssignmentRaw.assignment_category ?? "");
    if (!parsedCategory) {
      return NextResponse.json({ error: "בחרי סוג שיבוץ: חובה או התמחות" }, { status: 400 });
    }
    const category: AssignmentCategory = parsedCategory;

    const gradeResolved = await resolveGradeLevelsFromRequest(supabase, {
      grade_levels: newAssignmentRaw.grade_levels,
    });
    if ("error" in gradeResolved) {
      return NextResponse.json({ error: gradeResolved.error }, { status: 400 });
    }

    const multiTarget = normalizeMultiTargetInput({
      grade_levels: gradeResolved.gradeLevels,
      class_ids: newAssignmentRaw.class_ids,
      track_ids: newAssignmentRaw.track_ids,
      specialization_ids: newAssignmentRaw.specialization_ids,
      psychology_enabled: newAssignmentRaw.psychology_enabled,
      applies_to_all_in_grade: newAssignmentRaw.applies_to_all_in_grade,
    });

    const targetErr = validateMultiTarget(category, multiTarget);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      category === "חובה" && multiTarget.track_ids.length === 1
        ? multiTarget.track_ids[0]
        : null,
      newAssignmentRaw.teaching_mode,
    );
    if (teaching.error) {
      return NextResponse.json({ error: teaching.error }, { status: 400 });
    }

    if (category === "חובה" && multiTarget.track_ids.length === 1) {
      const { data: trackRow } = await supabase
        .from("tracks")
        .select("name")
        .eq("id", multiTarget.track_ids[0])
        .maybeSingle();
      if (isTeachingTrackName((trackRow?.name as string) ?? "")) {
        const raw = String(newAssignmentRaw.teaching_mode ?? "").trim();
        if (!isTeachingModeSelection(raw)) {
          return NextResponse.json(
            { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" },
            { status: 400 },
          );
        }
      }
    }

    subject = subjectLesson.subject;

    const resolved = await findOrCreateAssignment(supabase, yearScope.year.id, {
      teacher_id,
      subject,
      lesson_name: subjectLesson.lesson_name,
      assignment_category: category,
      teaching_mode: teaching.teaching_mode,
      ...multiTarget,
    });
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }
    assignmentId = resolved.id;
    if (resolved.created) assignmentsCreated = 1;
  } else {
    if (!subject) {
      const { data: ta } = await supabase
        .from("teacher_assignments")
        .select("subject")
        .eq("id", assignmentId)
        .maybeSingle();
      subject = (ta?.subject as string) ?? "";
    }
    if (!subject) {
      return NextResponse.json({ error: "מקצוע חובה" }, { status: 400 });
    }
  }

  const result = await createOneExam({
    supabase,
    academicYearId: yearScope.year.id,
    academicYearName: yearScope.year.year_name,
    teacherId: teacher_id,
    subject,
    examDate: exam_date,
    assignmentId,
    teachingMode,
    auditUserId: user?.id ?? null,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    exam: result.exam,
    exams: [result.exam],
    students_count: result.students_count,
    created_count: 1,
    assignments_created: assignmentsCreated,
  });
}
