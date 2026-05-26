import { NextResponse } from "next/server";
import { normalizeSubjectLessonFields } from "@/lib/assignments/excelImport";
import { findOrCreateAssignment } from "@/lib/assignments/findOrCreate";
import {
  computeTargetsFingerprint,
  formatGradeLevelsLabel,
  multiTargetTypeLabel,
  normalizeMultiTargetInput,
  resolveMultiTargetLabels,
  rowToMultiTarget,
  validateMultiTarget,
} from "@/lib/assignments/multiTarget";
import { parseAssignmentCategory } from "@/lib/assignments/target";
import { listGradeOptions } from "@/lib/academicYears/options";
import { filterGradeLevels, resolveGradeLevelsFromRequest } from "@/lib/gradeLevels/options";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { isTeachingTrackName } from "@/lib/students/fields";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import { isTeachingModeSelection } from "@/lib/teachers/teachingMode";
import { dedupeTeachersByName, teacherIdsWithSameName } from "@/lib/teachers/dedupe";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import type { AssignmentCategory, GradeLevel } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");
  const categoryParam = searchParams.get("assignment_category");
  const gradeFilter = filterGradeLevels(
    searchParams.get("grade_level") ? [searchParams.get("grade_level")!] : [],
  );

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  const grades = await listGradeOptions(supabase, scope.year.id);

  let q = notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS))
    .eq("academic_year_id", scope.year.id)
    .order("subject");
  if (teacherId) {
    const { data: allTeachers } = await notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS))
      .eq("academic_year_id", scope.year.id);
    const teacherIds = teacherIdsWithSameName(allTeachers ?? [], teacherId);
    q = q.in("teacher_id", teacherIds);
  }
  if (categoryParam === "חובה" || categoryParam === "התמחות") {
    q = q.eq("assignment_category", categoryParam);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let rows = data ?? [];
  if (gradeFilter.length) {
    rows = rows.filter((a) => {
      const gl = (a as { grade_levels?: string[] }).grade_levels ?? [];
      return gradeFilter.some((g) => gl.includes(g));
    });
  }

  const labelRows = rows.map((a) => {
    const row = a as {
      id: string;
      grade_levels: string[];
      class_ids: string[];
      track_ids: string[];
      specialization_ids: string[];
      psychology_enabled: boolean;
      applies_to_all_in_grade: boolean;
      assignment_category: AssignmentCategory;
    };
    return {
      id: row.id,
      ...rowToMultiTarget(row),
      assignment_category: row.assignment_category,
    };
  });
  const labels = await resolveMultiTargetLabels(supabase, labelRows);

  return NextResponse.json({
    assignments: rows.map((a) => {
      const row = a as {
        id: string;
        grade_levels: GradeLevel[];
        assignment_category: AssignmentCategory;
      };
      const mt = rowToMultiTarget(a as Parameters<typeof rowToMultiTarget>[0]);
      return {
        ...a,
        year_label: formatGradeLevelsLabel(mt.grade_levels),
        target_label: labels[row.id] ?? "—",
        target_type_label: multiTargetTypeLabel(mt, row.assignment_category),
      };
    }),
    grades,
    readOnly: scope.readOnly,
    academicYear: scope.year,
  });
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }

    const body = (await request.json()) as {
      teacher_id?: string;
      subject?: string;
      lesson_name?: string;
      grade_levels?: string[];
      grade_level?: string;
      grade_level_option_ids?: string[];
      class_ids?: string[];
      class_id?: string | null;
      track_ids?: string[];
      track_id?: string | null;
      specialization_ids?: string[];
      specialization_id?: string | null;
      psychology_enabled?: boolean;
      applies_to_all_in_grade?: boolean;
      assignment_category?: string;
      teaching_mode?: string;
    };

    const teacher_id = body.teacher_id?.trim();
    const subjectLesson = normalizeSubjectLessonFields(
      body.subject ?? "",
      body.lesson_name ?? "",
    );

    const gradeResolved = await resolveGradeLevelsFromRequest(supabase, body);
    if ("error" in gradeResolved) {
      return NextResponse.json({ error: gradeResolved.error }, { status: 400 });
    }

    if (!teacher_id) {
      return NextResponse.json({ error: "מורה חובה" }, { status: 400 });
    }
    if (subjectLesson.error) {
      return NextResponse.json({ error: subjectLesson.error }, { status: 400 });
    }

    const category = parseAssignmentCategory(body.assignment_category ?? "");
    if (!category) {
      return NextResponse.json({ error: "בחרי סוג שיבוץ: חובה או התמחות" }, { status: 400 });
    }

    const multiTarget = normalizeMultiTargetInput({
      grade_levels: gradeResolved.gradeLevels,
      class_ids: body.class_ids,
      class_id: body.class_id,
      track_ids: body.track_ids,
      track_id: body.track_id,
      specialization_ids: body.specialization_ids,
      specialization_id: body.specialization_id,
      psychology_enabled: body.psychology_enabled,
      applies_to_all_in_grade: body.applies_to_all_in_grade,
    });

    const targetErr = validateMultiTarget(category, multiTarget);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      category === "חובה" && multiTarget.track_ids.length === 1
        ? multiTarget.track_ids[0]
        : null,
      body.teaching_mode,
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
        const raw = String(body.teaching_mode ?? "").trim();
        if (!isTeachingModeSelection(raw)) {
          return NextResponse.json(
            { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" },
            { status: 400 },
          );
        }
      }
    }

    const fingerprint = computeTargetsFingerprint(multiTarget);
    const lesson = subjectLesson.lesson_name;

    const { data, error } = await supabase
      .from("teacher_assignments")
      .insert({
        academic_year_id: scope.year.id,
        teacher_id,
        subject: subjectLesson.subject,
        lesson_name: lesson,
        assignment_category: category,
        grade_levels: multiTarget.grade_levels,
        class_ids: multiTarget.class_ids,
        track_ids: multiTarget.track_ids,
        specialization_ids: multiTarget.specialization_ids,
        psychology_enabled: multiTarget.psychology_enabled,
        applies_to_all_in_grade: multiTarget.applies_to_all_in_grade,
        targets_fingerprint: fingerprint,
        teaching_mode: teaching.teaching_mode,
      })
      .select(ASSIGNMENT_WITH_LOOKUPS)
      .single();

    if (error) {
      if (error.message.includes("uq_teacher_assignment")) {
        const existing = await findOrCreateAssignment(supabase, scope.year.id, {
          teacher_id,
          subject: subjectLesson.subject,
          lesson_name: lesson,
          assignment_category: category,
          teaching_mode: teaching.teaching_mode,
          ...multiTarget,
        });
        if ("error" in existing) {
          return NextResponse.json({ error: existing.error }, { status: 400 });
        }
        const { data: row } = await supabase
          .from("teacher_assignments")
          .select(ASSIGNMENT_WITH_LOOKUPS)
          .eq("id", existing.id)
          .single();
        return NextResponse.json({
          assignment: row,
          created_count: 1,
          already_existed: !existing.created,
        });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ assignment: data, created_count: 1 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
