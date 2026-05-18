import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadCohortPairByIds,
  loadCohortPairByNumbers,
  loadDefaultCohortPair,
} from "@/lib/cohorts/active";
import { getSelectedCohortNumbers, setSelectedCohortNumbers } from "@/lib/cohorts/settings";
import type { CohortPairView } from "@/lib/cohorts/types";

export async function resolveSelectedCohortPair(supabase: SupabaseClient): Promise<CohortPairView | null> {
  const numbers = await getSelectedCohortNumbers(supabase);
  if (numbers) {
    const pair = await loadCohortPairByNumbers(supabase, numbers[0], numbers[1]);
    if (pair) return pair;
  }
  return loadDefaultCohortPair(supabase);
}

export async function setSelectedCohortPair(
  supabase: SupabaseClient,
  cohortAId: string,
  cohortBId: string,
): Promise<CohortPairView | null> {
  const pair = await loadCohortPairByIds(supabase, cohortAId, cohortBId);
  if (!pair) return null;
  await setSelectedCohortNumbers(supabase, [pair.cohortA.number, pair.cohortB.number]);
  return pair;
}

export async function selectedCohortIdList(supabase: SupabaseClient): Promise<string[]> {
  const pair = await resolveSelectedCohortPair(supabase);
  if (!pair) return [];
  return [pair.cohortA.id, pair.cohortB.id];
}
