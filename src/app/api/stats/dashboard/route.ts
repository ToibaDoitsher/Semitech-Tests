import { NextResponse } from "next/server";
import { notDeleted } from "@/lib/db/softDelete";
import { selectedCohortIdList } from "@/lib/cohorts/server";
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
  const cohortIds = await selectedCohortIdList(supabase);

  let examsTotalQ = notDeleted(supabase.from("exams").select("id", { count: "exact", head: true }));
  let examsTodayQ = notDeleted(
    supabase.from("exams").select("id", { count: "exact", head: true }),
  ).eq("exam_date", today);
  let examsUpcomingQ = notDeleted(
    supabase.from("exams").select("id", { count: "exact", head: true }),
  ).gte("exam_date", today);
  let studentsQ = notDeleted(supabase.from("students").select("id", { count: "exact", head: true }));
  if (cohortIds.length) {
    examsTotalQ = examsTotalQ.in("cohort_id", cohortIds);
    examsTodayQ = examsTodayQ.in("cohort_id", cohortIds);
    examsUpcomingQ = examsUpcomingQ.in("cohort_id", cohortIds);
    studentsQ = studentsQ.in("cohort_id", cohortIds);
  }

  const trackingQ =
    cohortIds.length
      ? supabase
          .from("exam_tracking")
          .select("id, exams!inner(cohort_id)", { count: "exact", head: true })
          .in("exams.cohort_id", cohortIds)
          .or("grades_submitted.eq.false,transferred_to_system.eq.false")
      : supabase
          .from("exam_tracking")
          .select("id", { count: "exact", head: true })
          .or("grades_submitted.eq.false,transferred_to_system.eq.false");

  const [
    examsTotal,
    examsToday,
    examsUpcoming,
    makeupsOpen,
    studentsTotal,
    trackingTodo,
  ] = await Promise.all([
    examsTotalQ,
    examsTodayQ,
    examsUpcomingQ,
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open"),
    studentsQ,
    trackingQ,
  ]);

  for (const r of [examsTotal, examsToday, examsUpcoming, makeupsOpen, studentsTotal, trackingTodo]) {
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
  }

  const { count: studentsInMakeup } = await supabase
    .from("exam_students")
    .select("id", { count: "exact", head: true })
    .in("status", ["makeup", "missing"]);

  return NextResponse.json({
    examsTotal: examsTotal.count ?? 0,
    examsToday: examsToday.count ?? 0,
    examsUpcoming: examsUpcoming.count ?? 0,
    makeupsOpen: makeupsOpen.count ?? 0,
    studentsTotal: studentsTotal.count ?? 0,
    studentsInMakeup: studentsInMakeup ?? 0,
    trackingTodo: trackingTodo.count ?? 0,
  });
}
