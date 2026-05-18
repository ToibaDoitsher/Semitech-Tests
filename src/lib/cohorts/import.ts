import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createCohortByNumber,
  findCohortByNumber,
} from "@/lib/cohorts/active";
import { gradeInPair } from "@/lib/cohorts/grades";
import { resolveSelectedCohortPair } from "@/lib/cohorts/server";
import type { GradeLevel } from "@/lib/cohorts/types";

export async function resolveImportTarget(
  supabase: SupabaseClient,
  cohortInput: string,
): Promise<{ cohortId: string; cohortNumber: number; grade: GradeLevel | null; error?: string }> {
  const cohortNumber = Number.parseInt(cohortInput.trim(), 10);
  if (!Number.isFinite(cohortNumber) || cohortNumber < 1) {
    return { cohortId: "", cohortNumber: 0, grade: null, error: "מספר מחזור לא תקין" };
  }

  let cohort = await findCohortByNumber(supabase, cohortNumber);
  if (!cohort) {
    try {
      cohort = await createCohortByNumber(supabase, cohortNumber);
    } catch (e) {
      return { cohortId: "", cohortNumber, grade: null, error: (e as Error).message };
    }
  }

  const pair = await resolveSelectedCohortPair(supabase);
  const grade = pair ? gradeInPair(cohort.id, pair) : null;

  return {
    cohortId: cohort.id,
    cohortNumber,
    grade,
  };
}
