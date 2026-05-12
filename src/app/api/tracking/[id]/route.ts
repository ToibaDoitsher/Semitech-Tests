import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    submitted_exam?: string | null;
    approved_by_coordinator?: boolean;
    sent_for_review?: boolean;
    grades_submitted?: boolean;
    grades_approved?: boolean;
    transferred_to_system?: boolean;
  };

  const supabase = createSupabaseAdminClient();

  const patch: Record<string, unknown> = {};
  if ("submitted_exam" in body) patch.submitted_exam = body.submitted_exam;
  if ("approved_by_coordinator" in body) patch.approved_by_coordinator = body.approved_by_coordinator;
  if ("sent_for_review" in body) patch.sent_for_review = body.sent_for_review;
  if ("grades_submitted" in body) patch.grades_submitted = body.grades_submitted;
  if ("grades_approved" in body) patch.grades_approved = body.grades_approved;
  if ("transferred_to_system" in body) patch.transferred_to_system = body.transferred_to_system;

  const { data, error } = await supabase
    .from("exam_tracking")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ row: data });
}
