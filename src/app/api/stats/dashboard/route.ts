import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const today = todayISODate();

  const [
    examsTotal,
    examsUpcoming,
    makeupsOpen,
    studentsTotal,
    trackingTodo,
  ] = await Promise.all([
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("exams").select("id", { count: "exact", head: true }).gte("exam_date", today),
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("exam_tracking")
      .select("id", { count: "exact", head: true })
      .or("grades_submitted.eq.false,transferred_to_system.eq.false"),
  ]);

  for (const r of [examsTotal, examsUpcoming, makeupsOpen, studentsTotal, trackingTodo]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  return NextResponse.json({
    examsTotal: examsTotal.count ?? 0,
    examsUpcoming: examsUpcoming.count ?? 0,
    makeupsOpen: makeupsOpen.count ?? 0,
    studentsTotal: studentsTotal.count ?? 0,
    trackingTodo: trackingTodo.count ?? 0,
  });
}
