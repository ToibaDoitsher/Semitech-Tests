import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cohortLabel,
  createCohortByNumber,
  findCohortByNumber,
  listAllCohorts,
  loadActiveCohortPair,
  openNewCohort,
} from "@/lib/cohorts/active";
import { gradeInPair } from "@/lib/cohorts/grades";

export {
  type CohortRow,
  type CohortPairView,
  type GradeLevel,
  cohortLabel,
  cohortLabel as cohortLabelFromRow,
  createCohortByNumber,
  findCohortByNumber,
  listAllCohorts,
  loadActiveCohortPair,
  openNewCohort,
  gradeInPair,
} from "@/lib/cohorts/active";

export async function listCohorts(supabase: SupabaseClient) {
  const rows = await listAllCohorts(supabase);
  return rows.map((r) => ({ id: r.id, name: cohortLabel(r) }));
}

export async function findCohortByLabel(supabase: SupabaseClient, label: string) {
  const num = Number.parseInt(label.trim(), 10);
  if (!Number.isFinite(num)) return null;
  return findCohortByNumber(supabase, num);
}

export async function createCohortByLabel(supabase: SupabaseClient, label: string) {
  const num = Number.parseInt(label.trim(), 10);
  if (!Number.isFinite(num)) throw new Error("מספר מחזור לא תקין");
  return createCohortByNumber(supabase, num);
}

export const STUDENT_WITH_LOOKUPS = `
  *,
  cohorts ( id, name, number, display_order ),
  classes ( id, name ),
  specializations ( id, name ),
  tracks ( id, name )
`;

export async function getStudentWithLookupsSelect() {
  return STUDENT_WITH_LOOKUPS;
}
