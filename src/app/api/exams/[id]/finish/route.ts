import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** יוצר רשומות השלמה לכל תלמידה במצב missing שלא קיימת לה השלמה פתוחה */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: examId } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: missingRows, error: qErr } = await supabase
    .from("exam_students")
    .select("student_id")
    .eq("exam_id", examId)
    .eq("status", "missing");

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const studentIds = (missingRows ?? []).map((r) => r.student_id);
  if (!studentIds.length) {
    return NextResponse.json({ created: 0, message: "אין תלמידות במצב חסר" });
  }

  const inserts = studentIds.map((student_id) => ({
    student_id,
    exam_id: examId,
    status: "open" as const,
    completed_at: null as null,
  }));

  const { error: insErr } = await supabase.from("makeup_exams").upsert(inserts, {
    onConflict: "student_id,exam_id",
    ignoreDuplicates: false,
  });

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  const { error: upErr } = await supabase
    .from("exam_students")
    .update({ status: "makeup" })
    .eq("exam_id", examId)
    .eq("status", "missing");

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

  return NextResponse.json({ created: studentIds.length });
}
