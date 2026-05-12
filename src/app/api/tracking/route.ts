import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("exam_tracking")
    .select("id, submitted_exam, approved_by_coordinator, sent_for_review, grades_submitted, grades_approved, transferred_to_system, exam_id, teacher_id")
    .order("id", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const examIds = [...new Set((rows ?? []).map((r) => r.exam_id))];
  let examsBy: Record<string, { subject: string; exam_date: string; teacher_name: string | null }> = {};

  if (examIds.length) {
    const { data: exams } = await supabase
      .from("exams")
      .select("id, subject, exam_date, teachers(name)")
      .in("id", examIds);
    for (const e of exams ?? []) {
      const raw = e as { id: string; subject: string; exam_date: string; teachers: unknown };
      const tn = raw.teachers as { name?: string } | { name?: string }[] | null | undefined;
      const name =
        Array.isArray(tn) ? tn[0]?.name : typeof tn === "object" && tn && "name" in tn ? tn.name : undefined;
      examsBy[raw.id] = {
        subject: raw.subject,
        exam_date: raw.exam_date,
        teacher_name: name ?? null,
      };
    }
  }

  const tracking = (rows ?? []).map((r) => ({
    ...r,
    exam: examsBy[r.exam_id] ?? null,
  }));

  return NextResponse.json({ tracking });
}
