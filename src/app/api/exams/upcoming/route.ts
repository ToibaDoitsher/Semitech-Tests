import { NextResponse } from "next/server";
import { resolveScopeFromUrl } from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { notDeleted } from "@/lib/db/softDelete";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function todayISODate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "8") || 8));
  const start = (searchParams.get("from") ?? todayISODate()).trim();

  const supabase = createSupabaseAdminClient();
  const scope = await resolveScopeFromUrl(supabase, searchParams);

  const { data: exams, error } = await notDeleted(
    supabase
      .from("exams")
      .select(
        "id, subject, exam_date, teacher_id, teachers ( id, first_name, last_name, full_name_generated )",
      ),
  )
    .eq("academic_year_id", scope.year.id)
    .eq("term", scope.term)
    .gte("exam_date", start)
    .order("exam_date", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: dbSchemaHint(error.message) }, { status: 500 });

  const examIds = (exams ?? []).map((e) => (e as { id: string }).id);
  let counts: Record<string, { took: number; open: number; completed: number; total: number }> = {};
  if (examIds.length) {
    const { data: lines } = await supabase.from("exam_students").select("exam_id, status").in("exam_id", examIds);
    for (const id of examIds) counts[id] = { took: 0, open: 0, completed: 0, total: 0 };
    for (const row of lines ?? []) {
      const r = row as { exam_id: string; status: string };
      if (!counts[r.exam_id]) counts[r.exam_id] = { took: 0, open: 0, completed: 0, total: 0 };
      counts[r.exam_id].total += 1;
      if (r.status === "took") counts[r.exam_id].took += 1;
      if (r.status === "makeup" || r.status === "missing" || r.status === "pending") counts[r.exam_id].open += 1;
      if (r.status === "completed") counts[r.exam_id].completed += 1;
    }
  }

  const items = (exams ?? []).map((raw) => {
    const e = raw as {
      id: string;
      subject: string;
      exam_date: string;
      teachers: unknown;
    };
    const teacherName = teacherEmbedDisplayName(
      e.teachers as Parameters<typeof teacherEmbedDisplayName>[0],
    );
    const c = counts[e.id] ?? { took: 0, open: 0, completed: 0, total: 0 };
    let statusLabel = "בתהליך";
    if (c.total > 0 && c.completed === c.total) statusLabel = "הושלמו בהשלמה";
    else if (c.total > 0 && c.took === c.total) statusLabel = "כולן נבחנו במועד";
    else if (c.open > 0) statusLabel = "להשלמה / ממתין";

    return {
      id: e.id,
      subject: e.subject,
      exam_date: e.exam_date,
      teacher_name: teacherName ?? "",
      statusLabel,
    };
  });

  return NextResponse.json({ items });
}
