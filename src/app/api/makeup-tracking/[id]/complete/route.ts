import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    completed_at?: string;
    notes?: string;
  };

  const supabase = createSupabaseAdminClient();

  const { data: row, error: loadErr } = await supabase
    .from("makeup_tracking")
    .select("id, exam_id, student_id, makeup_exam_id, grade")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });

  if (row.grade === null || row.grade === undefined) {
    return NextResponse.json({ error: "יש להזין ציון לפני סימון השלמה סופית" }, { status: 400 });
  }

  const completedAt = body.completed_at?.trim() || new Date().toISOString();
  const notes = body.notes !== undefined ? body.notes.trim() || null : undefined;

  if (row.makeup_exam_id) {
    const makeupPatch: Record<string, unknown> = {
      status: "completed",
      completed_at: completedAt,
      grade: row.grade,
    };
    if (notes !== undefined) makeupPatch.notes = notes;

    const { error: mErr } = await supabase
      .from("makeup_exams")
      .update(makeupPatch)
      .eq("id", row.makeup_exam_id);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
  }

  const { error: esErr } = await supabase
    .from("exam_students")
    .update({ status: "completed" })
    .eq("exam_id", row.exam_id)
    .eq("student_id", row.student_id);

  if (esErr) return NextResponse.json({ error: esErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
