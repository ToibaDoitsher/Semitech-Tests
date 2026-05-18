import { NextResponse } from "next/server";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import type { ExamTargetType } from "@/lib/types/db";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const body = (await request.json()) as {
    subject?: string;
    year_group?: number;
    grade_level?: string;
    target_type?: ExamTargetType;
    target_id?: string;
  };

  const patch: Record<string, unknown> = {};
  if (body.subject !== undefined) patch.subject = body.subject.trim();
  if (body.year_group !== undefined) patch.year_group = body.year_group;
  if (body.grade_level !== undefined) {
    const gl = parseGradeLevel(body.grade_level);
    if (!gl) return NextResponse.json({ error: "שכבה לא תקינה" }, { status: 400 });
    patch.grade_level = gl;
  }
  if (body.target_type !== undefined) patch.target_type = body.target_type;
  if (body.target_id !== undefined) patch.target_id = body.target_id.trim();

  if (body.target_type === "psychology" || (patch.target_type === "psychology" && !body.target_id)) {
    patch.target_id = scope.year.id;
  }

  const { data, error } = await supabase
    .from("teacher_assignments")
    .update(patch)
    .eq("id", id)
    .select(ASSIGNMENT_WITH_LOOKUPS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ assignment: data });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { error } = await supabase
    .from("teacher_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
