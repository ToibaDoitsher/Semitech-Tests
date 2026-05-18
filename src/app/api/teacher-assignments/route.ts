import { NextResponse } from "next/server";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { formatYearGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import { listYearGradeOptions } from "@/lib/academicYears/options";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import type { ExamTargetType, GradeLevel } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const targetTypeLabel: Record<string, string> = {
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
  psychology: "פסיכולוגיה",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");
  const targetType = searchParams.get("target_type") as ExamTargetType | null;
  const targetId = searchParams.get("target_id");
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
  if (targetType && ["class", "specialization", "track", "psychology"].includes(targetType)) {
    q = q.eq("target_type", targetType);
  }
  if (targetId) q = q.eq("target_id", targetId);
  if (gradeLevel) q = q.eq("grade_level", gradeLevel);
  if (Number.isFinite(yearGroup)) q = q.eq("year_group", yearGroup);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];
  const labels = await resolveExamTargetLabels(
    supabase,
    rows.map((a) => ({
      id: (a as { id: string }).id,
      target_type: (a as { target_type: ExamTargetType }).target_type,
      target_id: (a as { target_id: string }).target_id,
    })),
  );

  return NextResponse.json({
    assignments: rows.map((a) => {
      const row = a as { id: string; target_type: string; year_group: number; grade_level: GradeLevel };
      return {
        ...a,
        year_label: formatYearGradeLabel(row.year_group, row.grade_level),
        target_label: labels[row.id] ?? row.id,
        target_type_label: targetTypeLabel[row.target_type] ?? row.target_type,
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
      year_group?: number;
      grade_level?: string;
      target_type?: ExamTargetType;
      target_id?: string;
    };
    const teacher_id = body.teacher_id?.trim();
    const subject = (body.subject ?? "").trim();
    const year_group = Number(body.year_group);
    const grade_level = parseGradeLevel(String(body.grade_level ?? ""));
    const target_type = body.target_type;
    let target_id = (body.target_id ?? "").trim();

    if (!teacher_id || !subject || !Number.isFinite(year_group) || !grade_level || !target_type) {
      return NextResponse.json({ error: "כל השדות חובה כולל שנתון ושכבה" }, { status: 400 });
    }

    if (target_type === "psychology") {
      target_id = scope.year.id;
    } else if (!target_id) {
      return NextResponse.json({ error: "חובה לבחור יעד שיבוץ" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("teacher_assignments")
      .insert({
        academic_year_id: scope.year.id,
        teacher_id,
        subject,
        year_group,
        grade_level,
        target_type,
        target_id,
      })
      .select(ASSIGNMENT_WITH_LOOKUPS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assignment: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
