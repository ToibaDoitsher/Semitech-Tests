import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import type { ExamStudentStatus } from "@/lib/types/db";
import {
  assertExamNotLocked,
  assertNoOpenMakeupDuplicate,
  assertValidExamStudentStatusTransition,
} from "@/lib/validations/exams";
import { ensureMakeupTracking } from "@/lib/makeupTracking/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as { status?: ExamStudentStatus; from_student_card?: boolean };
  const status = body.status;
  const fromStudentCard = Boolean(body.from_student_card);

  if (!status || !["took", "missing", "pending", "makeup", "completed"].includes(status)) {
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const user = await getCurrentUser(supabase);

  const transition = await assertValidExamStudentStatusTransition(supabase, id, status);
  if (!transition.ok) return NextResponse.json({ error: transition.error }, { status: 400 });

  const { data: row, error: gErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, student_id, status")
    .eq("id", id)
    .single();

  if (gErr || !row) return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });

  if (!fromStudentCard) {
    const locked = await assertExamNotLocked(supabase, row.exam_id as string);
    if (!locked.ok) return NextResponse.json({ error: locked.error }, { status: 400 });
  }

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
    const dupMakeup = await assertNoOpenMakeupDuplicate(
      supabase,
      row.student_id as string,
      row.exam_id as string,
    );
    if (!dupMakeup.ok) return NextResponse.json({ error: dupMakeup.error }, { status: 400 });

    const { data: makeupRow, error: mErr } = await supabase
      .from("makeup_exams")
      .upsert(
        {
          student_id: row.student_id,
          exam_id: row.exam_id,
          status: "open",
          completed_at: null,
        },
        { onConflict: "student_id,exam_id" },
      )
      .select("id")
      .single();
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

    const track = await ensureMakeupTracking(supabase, {
      studentId: row.student_id as string,
      examId: row.exam_id as string,
      makeupExamId: makeupRow?.id ?? null,
    });
    if (track.error) return NextResponse.json({ error: track.error }, { status: 400 });
    nextStatus = "makeup";
  }

  const { data: updated, error: uErr } = await supabase
    .from("exam_students")
    .update({ status: nextStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam_student",
    entityId: id,
    actionType: "status_change",
    entityNameSnapshot: `סטטוס ${nextStatus}`,
    oldValue: { status: row.status },
    newValue: { status: nextStatus },
  });

  return NextResponse.json({ exam_student: updated });
}
