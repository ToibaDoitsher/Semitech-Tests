import { NextResponse } from "next/server";
import { cohortDisplayNumber, gradeInPair } from "@/lib/cohorts/grades";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import type { ExamTargetType } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSelectedCohortPair, selectedCohortIdList } from "@/lib/cohorts/server";

export const dynamic = "force-dynamic";

const targetTypeLabel: Record<string, string> = {
  class: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teacherId = searchParams.get("teacher_id");
  const targetType = searchParams.get("target_type") as ExamTargetType | null;
  const targetId = searchParams.get("target_id");
  const cohortId = searchParams.get("cohort_id");

  const supabase = createSupabaseAdminClient();
  const pair = await resolveSelectedCohortPair(supabase);
  const cohortIds = cohortId ? [cohortId] : await selectedCohortIdList(supabase);

  let q = notDeleted(supabase.from("teacher_assignments").select(ASSIGNMENT_WITH_LOOKUPS)).order(
    "subject",
  );
  if (teacherId) q = q.eq("teacher_id", teacherId);
  if (targetType && ["class", "specialization", "track"].includes(targetType)) q = q.eq("target_type", targetType);
  if (targetId) q = q.eq("target_id", targetId);
  if (cohortIds.length) q = q.in("cohort_id", cohortIds);

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

  const cohortOptions = pair
    ? [
        { id: pair.cohortA.id, number: pair.cohortA.number, name: cohortDisplayNumber(pair.cohortA), grade_level: gradeInPair(pair.cohortA.id, pair) },
        { id: pair.cohortB.id, number: pair.cohortB.number, name: cohortDisplayNumber(pair.cohortB), grade_level: gradeInPair(pair.cohortB.id, pair) },
      ]
    : [];

  return NextResponse.json({
    assignments: rows.map((a) => {
      const row = a as { id: string; target_type: string; cohort_id: string };
      const grade_level = pair ? gradeInPair(row.cohort_id, pair) : null;
      return {
        ...a,
        grade_level,
        target_label: labels[row.id] ?? row.id,
        target_type_label: targetTypeLabel[row.target_type] ?? row.target_type,
      };
    }),
    cohorts: cohortOptions,
    pair: pair ? { label: `${pair.cohortA.number} + ${pair.cohortB.number}` } : null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    cohort_id?: string;
    target_type?: ExamTargetType;
    target_id?: string;
  };
  const teacher_id = body.teacher_id?.trim();
  const subject = (body.subject ?? "").trim();
  const cohort_id = (body.cohort_id ?? "").trim();
  const target_type = body.target_type;
  const target_id = (body.target_id ?? "").trim();
  if (!teacher_id || !subject || !cohort_id || !target_type || !target_id) {
    return NextResponse.json({ error: "כל השדות חובה כולל שנתון" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const selectedIds = await selectedCohortIdList(supabase);
  if (selectedIds.length && !selectedIds.includes(cohort_id)) {
    return NextResponse.json({ error: "שנתון חייב להיות מתוך הזוג הנבחר" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("teacher_assignments")
    .insert({ teacher_id, subject, cohort_id, target_type, target_id })
    .select(ASSIGNMENT_WITH_LOOKUPS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}
