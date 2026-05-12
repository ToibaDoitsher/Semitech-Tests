import { NextResponse } from "next/server";
import type { ExamTargetType } from "@/lib/types/db";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    subject?: string;
    grade_level_id?: string;
    target_type?: ExamTargetType;
    target_id?: string;
    active?: boolean;
  };

  const patch: Record<string, unknown> = {};
  if (body.subject !== undefined) patch.subject = body.subject.trim();
  if (body.grade_level_id !== undefined) patch.grade_level_id = body.grade_level_id.trim();
  if (body.target_type !== undefined) patch.target_type = body.target_type;
  if (body.target_id !== undefined) patch.target_id = body.target_id.trim();
  if (body.active !== undefined) patch.active = body.active;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("teacher_assignments")
    .update(patch)
    .eq("id", id)
    .select(ASSIGNMENT_WITH_LOOKUPS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
