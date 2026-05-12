import { NextResponse } from "next/server";
import type { ExamStudentStatus } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { status?: ExamStudentStatus };
  const status = body.status;

  if (!status || !["took", "missing", "pending", "makeup", "completed"].includes(status)) {
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: row, error: gErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, student_id")
    .eq("id", id)
    .single();

  if (gErr || !row) return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });

  let nextStatus: ExamStudentStatus = status;

  if (status === "completed") {
    const now = new Date().toISOString();
    await supabase
      .from("makeup_exams")
      .update({ status: "completed", completed_at: now })
      .eq("exam_id", row.exam_id)
      .eq("student_id", row.student_id);
  }

  if (status === "missing") {
    const { error: mErr } = await supabase.from("makeup_exams").upsert(
      {
        student_id: row.student_id,
        exam_id: row.exam_id,
        status: "open",
        completed_at: null,
      },
      { onConflict: "student_id,exam_id" },
    );
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });
    nextStatus = "makeup";
  }

  const { data: updated, error: uErr } = await supabase
    .from("exam_students")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });
  return NextResponse.json({ exam_student: updated });
}
