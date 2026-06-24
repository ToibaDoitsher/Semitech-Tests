import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PatchBody = {
  submitted_exam?: string | null;
  student_submission_date?: string | null;
  reminder_1_hindi?: string | null;
  reminder_2_biller?: string | null;
  approved_by_coordinator?: boolean;
  sent_for_review?: boolean;
  grades_submitted?: boolean;
  grades_approved?: boolean;
  transferred_to_system?: boolean;
};

const OPTIONAL_DATE_COLUMNS = [
  "student_submission_date",
  "reminder_1_hindi",
  "reminder_2_biller",
] as const;

const PATCH_HINTS: Record<(typeof OPTIONAL_DATE_COLUMNS)[number], string> = {
  student_submission_date: "supabase/PATCH_TRACKING_STUDENT_SUBMISSION_DATE.sql",
  reminder_1_hindi: "supabase/PATCH_TRACKING_REMINDERS.sql",
  reminder_2_biller: "supabase/PATCH_TRACKING_REMINDERS.sql",
};

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as PatchBody;

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
  if ("reminder_1_hindi" in body) {
    patch.reminder_1_hindi = normalizeDateInput(body.reminder_1_hindi);
  }
  if ("reminder_2_biller" in body) {
    patch.reminder_2_biller = normalizeDateInput(body.reminder_2_biller);
  }
  if ("approved_by_coordinator" in body) patch.approved_by_coordinator = body.approved_by_coordinator;
  if ("sent_for_review" in body) patch.sent_for_review = body.sent_for_review;
  if ("grades_submitted" in body) patch.grades_submitted = body.grades_submitted;
  if ("grades_approved" in body) patch.grades_approved = body.grades_approved;
  if ("transferred_to_system" in body) patch.transferred_to_system = body.transferred_to_system;

  let workingPatch = { ...patch };
  const warnings: string[] = [];

  for (let attempt = 0; attempt <= OPTIONAL_DATE_COLUMNS.length; attempt += 1) {
    const { data, error } = await supabase
      .from("exam_tracking")
      .update(workingPatch)
      .eq("id", id)
      .select("*")
      .single();

    if (!error) {
      return NextResponse.json({
        row: data,
        ...(warnings.length ? { warning: warnings.join(" ") } : {}),
      });
    }

    const missing = OPTIONAL_DATE_COLUMNS.find(
      (col) => col in workingPatch && new RegExp(col, "i").test(error.message),
    );
    if (!missing) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    warnings.push(
      `העמודה ${missing} עוד לא קיימת ב-DB. הריצי את ${PATCH_HINTS[missing]}.`,
    );
    const nextPatch = { ...workingPatch };
    delete nextPatch[missing];
    workingPatch = nextPatch;
  }

  return NextResponse.json({ error: "עדכון נכשל" }, { status: 400 });
}

function normalizeDateInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return trimmed;
}
