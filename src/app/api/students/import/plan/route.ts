import { NextResponse } from "next/server";
import { resolveImportTarget } from "@/lib/students/importTarget";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PlanBody = {
  academic_year_name?: string;
  cohort_number?: string | number;
  valid_count?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as PlanBody;
  const academicYearName = (body.academic_year_name ?? "").trim();
  const cohortInput = String(body.cohort_number ?? "").trim();
  const validCount = Number(body.valid_count ?? 0);

  if (!academicYearName || !cohortInput) {
    return NextResponse.json({ error: "חובה שנת לימודים ומחזור" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const target = await resolveImportTarget(supabase, academicYearName, cohortInput);
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 });

  return NextResponse.json({
    plan: {
      academicYearName,
      cohortNumber: target.cohortNumber,
      targetGrade: target.grade,
      willImportCount: validCount,
    },
  });
}
