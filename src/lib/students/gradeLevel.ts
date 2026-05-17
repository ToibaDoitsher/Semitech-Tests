import type { SupabaseClient } from "@supabase/supabase-js";

export type GradeLevel = "א" | "ב";

export function formatGradeLevel(grade: GradeLevel | null | undefined): string {
  return grade ?? "—";
}

export async function getMaxCohortInYear(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("students")
    .select("cohort_number")
    .eq("academic_year_id", academicYearId)
    .order("cohort_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.cohort_number ?? 0;
}

/** מחזור חדש ביותר בשכבה א׳, אחרת ב׳ */
export function resolveGradeForCohort(cohortNumber: number, maxCohortInYear: number): GradeLevel {
  if (!Number.isFinite(cohortNumber) || cohortNumber < 1) {
    throw new Error("מספר מחזור לא תקין");
  }
  if (cohortNumber > maxCohortInYear) return "א";
  if (cohortNumber === maxCohortInYear) return "א";
  return "ב";
}

export async function resolveGradeForCohortInYear(
  supabase: SupabaseClient,
  academicYearId: string,
  cohortNumber: number,
): Promise<GradeLevel> {
  const max = await getMaxCohortInYear(supabase, academicYearId);
  return resolveGradeForCohort(cohortNumber, max);
}
