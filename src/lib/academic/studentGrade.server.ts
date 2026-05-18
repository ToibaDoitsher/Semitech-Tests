import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichStudentsWithGrade, type StudentCohortRef } from "@/lib/academic/studentGrade";
import type { GradeLevel } from "@/lib/cohorts/types";
import { resolveSelectedCohortPair } from "@/lib/cohorts/server";

export async function enrichStudentsWithGradeForYear<T extends StudentCohortRef>(
  supabase: SupabaseClient,
  students: T[],
): Promise<(T & { grade_level: GradeLevel | null; cohort_name: string | null })[]> {
  const pair = await resolveSelectedCohortPair(supabase);
  return enrichStudentsWithGrade(students, pair);
}
