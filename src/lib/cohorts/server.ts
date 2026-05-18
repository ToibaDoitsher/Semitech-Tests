import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadCohortPairByIds,
  loadDefaultCohortPair,
} from "@/lib/cohorts/active";
import { getSelectedCohortIds, setSelectedCohortIds } from "@/lib/cohorts/settings";
import type { CohortPairView } from "@/lib/cohorts/types";

export async function resolveSelectedCohortPair(supabase: SupabaseClient): Promise<CohortPairView | null> {
  const ids = await getSelectedCohortIds(supabase);
  if (ids) {
    const pair = await loadCohortPairByIds(supabase, ids[0], ids[1]);
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
  await setSelectedCohortIds(supabase, [pair.cohortA.id, pair.cohortB.id]);
  return pair;
}

export async function selectedCohortIdList(supabase: SupabaseClient): Promise<string[]> {
  const pair = await resolveSelectedCohortPair(supabase);
  if (!pair) return [];
  return [pair.cohortA.id, pair.cohortB.id];
}
