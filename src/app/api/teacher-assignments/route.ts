import { NextResponse } from "next/server";
import {
  assignmentTargetTypeLabel,
  normalizeTargetInput,
  parseAssignmentCategory,
  resolveAssignmentTargetLabels,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import type { AssignmentCategory } from "@/lib/types/db";
import { formatGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import { listGradeOptions } from "@/lib/academicYears/options";
import { resolveGradeLevelsFromOptionIds } from "@/lib/gradeLevels/options";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { normalizeSubjectLessonFields } from "@/lib/assignments/excelImport";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import type { GradeLevel } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");
  const classId = searchParams.get("class_id");
  const specializationId = searchParams.get("specialization_id");
  const trackId = searchParams.get("track_id");
  const psychology = searchParams.get("psychology_enabled");
  const categoryParam = searchParams.get("assignment_category");
  const gradeLevel = parseGradeLevel(searchParams.get("grade_level") ?? "");

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  const grades = await listGradeOptions(supabase, scope.year.id);

  let q = notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS))
    .eq("academic_year_id", scope.year.id)
    .order("subject");
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (classId) q = q.eq("class_id", classId);
  if (specializationId) q = q.eq("specialization_id", specializationId);
  if (trackId) q = q.eq("track_id", trackId);
  if (psychology === "true") q = q.eq("psychology_enabled", true);
  if (categoryParam === "חובה" || categoryParam === "התמחות") {
    q = q.eq("assignment_category", categoryParam);
  }
  if (gradeLevel) q = q.eq("grade_level", gradeLevel);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const labels = await resolveAssignmentTargetLabels(
    supabase,
    rows.map((a) => {
      const row = a as {
        id: string;
        class_id: string | null;
        specialization_id: string | null;
        track_id: string | null;
        psychology_enabled: boolean;
        assignment_category: AssignmentCategory;
      };
      return {
        id: row.id,
        class_id: row.class_id,
        specialization_id: row.specialization_id,
        track_id: row.track_id,
        psychology_enabled: row.psychology_enabled,
        assignment_category: row.assignment_category,
      };
    }),
  );

  return NextResponse.json({
    assignments: rows.map((a) => {
      const row = a as {
        id: string;
        grade_level: GradeLevel;
        class_id: string | null;
        specialization_id: string | null;
        track_id: string | null;
        psychology_enabled: boolean;
        assignment_category: AssignmentCategory;
      };
      const targetCols = {
        class_id: row.class_id,
        specialization_id: row.specialization_id,
        track_id: row.track_id,
        psychology_enabled: row.psychology_enabled,
      };
      return {
        ...a,
        year_label: formatGradeLabel(row.grade_level),
        target_label: labels[row.id] ?? "—",
        target_type_label: assignmentTargetTypeLabel(targetCols, row.assignment_category),
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
      grade_level?: string;
      grade_level_option_id?: string;
      grade_level_option_ids?: string[];
      class_id?: string | null;
      specialization_id?: string | null;
      track_id?: string | null;
      psychology_enabled?: boolean;
      assignment_category?: string;
      teaching_mode?: string;
    };
    const teacher_id = body.teacher_id?.trim();
    const subjectLesson = normalizeSubjectLessonFields(
      body.subject ?? "",
      body.lesson_name ?? "",
    );

    const optionIds = [
      ...(body.grade_level_option_ids ?? []).map((id) => id.trim()).filter(Boolean),
      ...(body.grade_level_option_id?.trim() ? [body.grade_level_option_id.trim()] : []),
    ];
    const gradeResolved = await resolveGradeLevelsFromOptionIds(
      supabase,
      optionIds,
      body.grade_level,
    );
    if ("error" in gradeResolved) {
      return NextResponse.json({ error: gradeResolved.error }, { status: 400 });
    }
    const gradeLevels = gradeResolved.gradeLevels;

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

    const target = normalizeTargetInput({
      class_id: body.class_id,
      specialization_id: body.specialization_id,
      track_id: body.track_id,
      psychology_enabled: body.psychology_enabled,
    });
    const targetErr = validateAssignmentWithCategory(category, target);
    if (targetErr) return NextResponse.json({ error: targetErr }, { status: 400 });

    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      category === "חובה" ? target.track_id : null,
      body.teaching_mode,
    );
    if (teaching.error) {
      return NextResponse.json({ error: teaching.error }, { status: 400 });
    }

    const created: unknown[] = [];
    for (const grade_level of gradeLevels) {
      const { data, error } = await supabase
        .from("teacher_assignments")
        .insert({
          academic_year_id: scope.year.id,
          teacher_id,
          subject: subjectLesson.subject,
          lesson_name: subjectLesson.lesson_name,
          assignment_category: category,
          grade_level,
          class_id: target.class_id,
          specialization_id: target.specialization_id,
          track_id: target.track_id,
          psychology_enabled: target.psychology_enabled,
          teaching_mode: teaching.teaching_mode,
        })
        .select(ASSIGNMENT_WITH_LOOKUPS)
        .single();
      if (error) {
        const msg = error.message.includes("uq_teacher_assignment")
          ? `שיבוץ כבר קיים לשכבה ${formatGradeLabel(grade_level)}`
          : error.message;
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      created.push(data);
    }

    if (created.length === 1) {
      return NextResponse.json({ assignment: created[0], created_count: 1 });
    }
    return NextResponse.json({ assignments: created, created_count: created.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
