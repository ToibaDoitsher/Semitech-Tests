import { NextResponse } from "next/server";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { ASSIGNMENT_WITH_LOOKUPS } from "@/lib/db/assignmentSelect";
import { resolveAssignmentTeachingMode } from "@/lib/teachers/assignments";
import type { ExamTargetType } from "@/lib/types/db";
import { notDeleted } from "@/lib/db/softDelete";
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

  const { data: existing, error: loadErr } = await notDeleted(
    supabase.from("teacher_assignments").select("id, target_type, target_id, teacher_id"),
  )
    .eq("id", id)
    .eq("academic_year_id", scope.year.id)
    .maybeSingle();
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "שיבוץ לא נמצא" }, { status: 404 });

  const body = (await request.json()) as {
    teacher_id?: string;
    subject?: string;
    lesson_name?: string | null;
    year_group?: number;
    grade_level?: string;
    target_type?: ExamTargetType;
    target_id?: string;
    teaching_mode?: string | null;
  };

  const patch: Record<string, unknown> = {};
  if (body.teacher_id !== undefined) {
    const tid = body.teacher_id.trim();
    if (!tid) return NextResponse.json({ error: "מורה חובה" }, { status: 400 });
    patch.teacher_id = tid;
  }
  if (body.subject !== undefined) patch.subject = body.subject.trim();
  if (body.lesson_name !== undefined) {
    patch.lesson_name = (body.lesson_name ?? "").trim() || null;
  }
  if (body.year_group !== undefined) patch.year_group = body.year_group;
  if (body.grade_level !== undefined) {
    const gl = parseGradeLevel(body.grade_level);
    if (!gl) return NextResponse.json({ error: "שכבה לא תקינה" }, { status: 400 });
    patch.grade_level = gl;
  }

  const targetType = (body.target_type ?? existing.target_type) as ExamTargetType;
  if (body.target_type !== undefined) patch.target_type = body.target_type;
  if (body.target_id !== undefined || body.target_type !== undefined) {
    if (targetType === "psychology") {
      patch.target_id = scope.year.id;
    } else {
      const tid = (body.target_id ?? existing.target_id).trim();
      if (!tid) return NextResponse.json({ error: "חובה לבחור יעד שיבוץ" }, { status: 400 });
      patch.target_id = tid;
    }
  }

  const resolvedTargetId = (patch.target_id ?? existing.target_id) as string;
  if (body.teaching_mode !== undefined) {
    const teaching = await resolveAssignmentTeachingMode(
      supabase,
      targetType,
      resolvedTargetId,
      body.teaching_mode,
    );
    if (teaching.error) {
      return NextResponse.json({ error: teaching.error }, { status: 400 });
    }
    patch.teaching_mode = teaching.teaching_mode;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
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
