import { NextResponse } from "next/server";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ students: [], exams: [] });

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  const studentsQ = notDeleted(
    supabase
      .from("students")
      .select("id, first_name, last_name, tz, year_group, grade_level")
      .eq("academic_year_id", scope.year.id)
      .limit(8),
  ).or(`first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`);

  const examsQ = notDeleted(
    supabase
      .from("exams")
      .select("id, subject, exam_date, year_group, grade_level, teachers(name)")
      .eq("academic_year_id", scope.year.id)
      .limit(8),
  ).ilike("subject", `%${escaped}%`);

  const [{ data: students, error: sErr }, { data: exams, error: eErr }] = await Promise.all([
    studentsQ,
    examsQ,
  ]);

  if (sErr || eErr) {
    return NextResponse.json({ error: (sErr ?? eErr)?.message }, { status: 500 });
  }

  return NextResponse.json({ students: students ?? [], exams: exams ?? [] });
}
