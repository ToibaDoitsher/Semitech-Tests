import { NextResponse } from "next/server";
import { notDeleted } from "@/lib/db/softDelete";
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

  const examsTodayQ = notDeleted(
    supabase.from("exams").select("id", { count: "exact", head: true }),
  ).eq("exam_date", today);

  const trackingQ = notDeleted(supabase.from("exam_tracking").select("id", { count: "exact", head: true })).or(
    "grades_submitted.eq.false,transferred_to_system.eq.false",
  );

  const [{ count: examsToday }, { count: trackingTodo }] = await Promise.all([
    examsTodayQ,
    trackingQ,
  ]);

  const items = [];
  if ((examsToday ?? 0) > 0) {
    items.push({
      id: "exams-today",
      title: `${examsToday} מבחנים היום`,
      body: "לחצי ליומן",
      href: "/calendar",
    });
  }
  if ((trackingTodo ?? 0) > 0) {
    items.push({
      id: "tracking-todo",
      title: `${trackingTodo} מבחנים במעקב`,
      body: "טרם הושלם מעקב",
      href: "/tracking",
    });
  }

  return NextResponse.json({ items });
}
