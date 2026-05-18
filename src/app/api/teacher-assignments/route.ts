import { NextResponse } from "next/server";
import {
  assignmentTargetTypeLabel,
  normalizeTargetInput,
  parseAssignmentCategory,
  resolveAssignmentTargetLabels,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import type { AssignmentCategory } from "@/lib/types/db";
import { formatYearGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import { listYearGradeOptions } from "@/lib/academicYears/options";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
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
  const yearGroupRaw = searchParams.get("year_group");
  const yearGroup = yearGroupRaw ? Number.parseInt(yearGroupRaw, 10) : NaN;

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  const layers = await listYearGradeOptions(supabase, scope.year.id);

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
  if (Number.isFinite(yearGroup)) q = q.eq("year_group", yearGroup);

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
        year_group: number;
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
        year_label: formatYearGradeLabel(row.year_group, row.grade_level),
        target_label: labels[row.id] ?? "—",
        target_type_label: assignmentTargetTypeLabel(targetCols, row.assignment_category),
      };
    }),
    layers,
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
      year_group?: number;
      grade_level?: string;
      class_id?: string | null;
      specialization_id?: string | null;
      track_id?: string | null;
      psychology_enabled?: boolean;
      assignment_category?: string;
      teaching_mode?: string;
    };
    const teacher_id = body.teacher_id?.trim();
    const subject = (body.subject ?? "").trim();
    const lesson_name = (body.lesson_name ?? "").trim() || null;
    const year_group = Number(body.year_group);
    const grade_level = parseGradeLevel(String(body.grade_level ?? ""));

    if (!teacher_id || !subject || !Number.isFinite(year_group) || !grade_level) {
      return NextResponse.json({ error: "כל השדות חובה כולל שנתון ושכבה" }, { status: 400 });
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

    const { data, error } = await supabase
      .from("teacher_assignments")
      .insert({
        academic_year_id: scope.year.id,
        teacher_id,
        subject,
        lesson_name,
        assignment_category: category,
        year_group,
        grade_level,
        class_id: target.class_id,
        specialization_id: target.specialization_id,
        track_id: target.track_id,
        psychology_enabled: target.psychology_enabled,
        teaching_mode: teaching.teaching_mode,
      })
      .select(ASSIGNMENT_WITH_LOOKUPS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
