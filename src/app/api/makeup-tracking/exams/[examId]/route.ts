import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ examId: string }> }) {
  const { examId } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("makeup_tracking")
    .select(
      "id, student_id, sent_to_teacher_at, grade_received_at, grade, notes, makeup_exam_id, created_at",
    )
    .eq("exam_id", examId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const studentIds = [...new Set((rows ?? []).map((r) => r.student_id as string))];
  const studentsBy: Record<string, { first_name: string; last_name: string; tz: string }> = {};
  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select("id, first_name, last_name, tz")
      .in("id", studentIds);
    for (const s of studs ?? []) {
      studentsBy[s.id as string] = {
        first_name: s.first_name as string,
        last_name: s.last_name as string,
        tz: s.tz as string,
      };
    }
  }

  const makeupIds = (rows ?? [])
    .map((r) => r.makeup_exam_id as string | null)
    .filter((id): id is string => Boolean(id));
  const makeupBy: Record<string, { status: string; completed_at: string | null }> = {};
  if (makeupIds.length) {
    const { data: makeups } = await supabase
      .from("makeup_exams")
      .select("id, status, completed_at")
      .in("id", makeupIds);
    for (const m of makeups ?? []) {
      makeupBy[m.id as string] = {
        status: m.status as string,
        completed_at: (m.completed_at as string | null) ?? null,
      };
    }
  }

  const items = (rows ?? []).map((r) => {
    const makeup = r.makeup_exam_id ? makeupBy[r.makeup_exam_id as string] : null;
    return {
      ...r,
      student: studentsBy[r.student_id as string] ?? null,
      makeup_status: makeup?.status ?? "open",
      makeup_completed_at: makeup?.completed_at ?? null,
    };
  });

  return NextResponse.json({ items });
}
