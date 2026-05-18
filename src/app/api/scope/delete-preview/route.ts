import { NextResponse } from "next/server";
import { listYearGradeOptions } from "@/lib/academicYears/options";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { previewScopedDeletesDetailed } from "@/lib/scope/bulkDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  const layers = await listYearGradeOptions(supabase, scope.year.id);
  const { preview, byGrade } = await previewScopedDeletesDetailed(supabase, scope.year.id, layers);

  const lines = byGrade.map((c) => {
    const parts = [
      c.students ? `${c.students} תלמידות` : null,
      c.exams ? `${c.exams} מבחנים` : null,
      c.assignments ? `${c.assignments} שיבוצים` : null,
    ].filter(Boolean);
    return `שנתון ${c.year_group} — שכבה ${c.grade_level}: ${parts.join(", ") || "אין רשומות"}`;
  });

  return NextResponse.json({
    preview,
    byGrade,
    layers,
    readOnly: scope.readOnly,
    academicYear: scope.year,
    summaryText: lines.join("\n"),
  });
}
