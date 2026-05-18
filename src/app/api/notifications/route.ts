import { NextResponse } from "next/server";
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

  let examsTodayQ = supabase.from("exams").select("id", { count: "exact", head: true }).eq("exam_date", today);
  if (cohortIds.length) examsTodayQ = examsTodayQ.in("cohort_id", cohortIds);

  let trackingQ = supabase
    .from("exam_tracking")
    .select("id, exam_id, exams!inner(exam_date, cohort_id)", { count: "exact", head: true })
    .eq("grades_submitted", false)
    .lte("exams.exam_date", today);
  if (cohortIds.length) trackingQ = trackingQ.in("exams.cohort_id", cohortIds);

  const [examsToday, makeupsOpen, trackingOpen] = await Promise.all([
    examsTodayQ,
    supabase.from("makeup_exams").select("id", { count: "exact", head: true }).eq("status", "open"),
    trackingQ,
  ]);

  const items: { id: string; type: string; message: string; href: string }[] = [];

  if ((examsToday.count ?? 0) > 0) {
    items.push({
      id: "exams-today",
      type: "info",
      message: `יש ${examsToday.count} מבחנים היום`,
      href: "/calendar",
    });
  }
  if ((makeupsOpen.count ?? 0) > 0) {
    items.push({
      id: "makeups-open",
      type: "warning",
      message: `יש ${makeupsOpen.count} השלמות פתוחות`,
      href: "/makeups",
    });
  }
  if ((trackingOpen.count ?? 0) > 0) {
    items.push({
      id: "tracking-todo",
      type: "warning",
      message: `יש ${trackingOpen.count} מבחנים ללא ציונים / מעקב`,
      href: "/tracking",
    });
  }

  return NextResponse.json({ items, unread: items.length });
}
