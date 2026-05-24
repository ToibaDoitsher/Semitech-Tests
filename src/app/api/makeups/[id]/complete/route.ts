import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    completed_at?: string;
    notes?: string;
  };

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: m, error: gErr } = await supabase
    .from("makeup_exams")
    .select("id, student_id, exam_id, status, academic_year_id")
    .eq("id", id)
    .single();

  if (gErr || !m) return NextResponse.json({ error: "רשומת השלמה לא נמצאה" }, { status: 404 });
  if (m.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "רשומה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }
  if (m.status !== "open") {
    return NextResponse.json({ error: "ההשלמה כבר סומנה כהושלמה" }, { status: 400 });
  }

  let completedAt: string;
  if (body.completed_at?.trim()) {
    const d = new Date(body.completed_at);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "תאריך השלמה לא תקין" }, { status: 400 });
    }
    completedAt = d.toISOString();
  } else {
    completedAt = new Date().toISOString();
  }

  const notes = body.notes !== undefined ? body.notes.trim() || null : undefined;
  const makeupPatch: Record<string, unknown> = {
    status: "completed",
    completed_at: completedAt,
  };
  if (notes !== undefined) makeupPatch.notes = notes;

  const { error: mErr } = await supabase.from("makeup_exams").update(makeupPatch).eq("id", id);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const { error: esErr } = await supabase
    .from("exam_students")
    .update({ status: "completed" })
    .eq("exam_id", m.exam_id)
    .eq("student_id", m.student_id);

  if (esErr) return NextResponse.json({ error: esErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, completed_at: completedAt });
}
