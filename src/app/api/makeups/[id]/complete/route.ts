import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: m, error: gErr } = await supabase
    .from("makeup_exams")
    .select("id, student_id, exam_id, status")
    .eq("id", id)
    .single();

  if (gErr || !m) return NextResponse.json({ error: "רשומת השלמה לא נמצאה" }, { status: 404 });
  if (m.status !== "open") {
    return NextResponse.json({ error: "ההשלמה כבר סומנה כהושלמה" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { error: mErr } = await supabase
    .from("makeup_exams")
    .update({ status: "completed", completed_at: now })
    .eq("id", id);

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const { error: esErr } = await supabase
    .from("exam_students")
    .update({ status: "completed" })
    .eq("exam_id", m.exam_id)
    .eq("student_id", m.student_id);

  if (esErr) return NextResponse.json({ error: esErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
