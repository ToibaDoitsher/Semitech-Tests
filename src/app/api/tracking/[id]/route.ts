import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    submitted_exam?: string | null;
    student_submission_date?: string | null;
    approved_by_coordinator?: boolean;
    sent_for_review?: boolean;
    grades_submitted?: boolean;
    grades_approved?: boolean;
    transferred_to_system?: boolean;
  };

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing } = await supabase
    .from("exam_tracking")
    .select("academic_year_id")
    .eq("id", id)
    .maybeSingle();
  if (existing && existing.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מעקב לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if ("submitted_exam" in body) patch.submitted_exam = body.submitted_exam;
  if ("student_submission_date" in body) {
    patch.student_submission_date = normalizeDateInput(body.student_submission_date);
  }
  if ("approved_by_coordinator" in body) patch.approved_by_coordinator = body.approved_by_coordinator;
  if ("sent_for_review" in body) patch.sent_for_review = body.sent_for_review;
  if ("grades_submitted" in body) patch.grades_submitted = body.grades_submitted;
  if ("grades_approved" in body) patch.grades_approved = body.grades_approved;
  if ("transferred_to_system" in body) patch.transferred_to_system = body.transferred_to_system;

  let { data, error } = await supabase
    .from("exam_tracking")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error && "student_submission_date" in patch && /student_submission_date/i.test(error.message)) {
    const fallbackPatch = { ...patch };
    delete fallbackPatch.student_submission_date;
    const retry = await supabase
      .from("exam_tracking")
      .update(fallbackPatch)
      .eq("id", id)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
    if (!error) {
      return NextResponse.json({
        row: data,
        warning: "העמודה student_submission_date עוד לא קיימת ב-DB. הריצי את supabase/PATCH_TRACKING_STUDENT_SUBMISSION_DATE.sql.",
      });
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}

function normalizeDateInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
}
