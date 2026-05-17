import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveGradeForCohortInYear, type GradeLevel } from "@/lib/students/gradeLevel";

export async function resolveImportTarget(
  supabase: SupabaseClient,
  yearName: string,
  cohortInput: string,
): Promise<{ yearId: string; cohortNumber: number; grade: GradeLevel; error?: string }> {
  const cohortNumber = Number.parseInt(cohortInput.trim(), 10);
  if (!Number.isFinite(cohortNumber) || cohortNumber < 1) {
    return { yearId: "", cohortNumber: 0, grade: "א", error: "מספר מחזור לא תקין" };
  }

  const { data: year, error: yErr } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("name", yearName.trim())
    .maybeSingle();

  if (yErr) return { yearId: "", cohortNumber, grade: "א", error: yErr.message };
  if (!year) {
    return {
      yearId: "",
      cohortNumber,
      grade: "א",
      error: `שנת לימודים "${yearName}" לא קיימת — פתחי שנת לימודים חדשה תחילה`,
    };
  }

  const grade = await resolveGradeForCohortInYear(supabase, year.id as string, cohortNumber);
  return { yearId: year.id as string, cohortNumber, grade };
}
