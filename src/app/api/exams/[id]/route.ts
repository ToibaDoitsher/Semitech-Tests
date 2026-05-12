import { NextResponse } from "next/server";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import type { ExamTargetType } from "@/lib/types/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: exam, error: eErr } = await supabase
    .from("exams")
    .select("*, teachers(name)")
    .eq("id", id)
    .single();

  if (eErr || !exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });

  const row = exam as { id: string; target_type: ExamTargetType; target_id: string };
  const labels = await resolveExamTargetLabels(supabase, [row]);
  const examEnriched = { ...exam, target_label: labels[row.id] ?? row.target_id };

  const { data: lines, error: lErr } = await supabase
    .from("exam_students")
    .select("id, status, updated_at, student_id")
    .eq("exam_id", id);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  const studentIds = [...new Set((lines ?? []).map((l) => l.student_id))];
  let byStudent: Record<string, { first_name: string; last_name: string; tz: string }> = {};

  if (studentIds.length) {
    const { data: studs } = await supabase
      .from("students")
      .select("id, first_name, last_name, tz")
      .in("id", studentIds);

    for (const s of studs ?? []) {
      const r = s as { id: string; first_name: string; last_name: string; tz: string };
      byStudent[r.id] = {
        first_name: r.first_name,
        last_name: r.last_name,
        tz: r.tz,
      };
    }
  }

  const exam_students = (lines ?? [])
    .map((l) => ({
      ...l,
      students: byStudent[l.student_id] ?? null,
    }))
    .sort((a, b) => {
      const la = `${a.students?.last_name ?? ""} ${a.students?.first_name ?? ""}`;
      const lb = `${b.students?.last_name ?? ""} ${b.students?.first_name ?? ""}`;
      return la.localeCompare(lb, "he");
    });

  return NextResponse.json({ exam: examEnriched, exam_students });
}
