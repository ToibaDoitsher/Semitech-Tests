import type { SupabaseClient } from "@supabase/supabase-js";

export const SELECTED_COHORTS_KEY = "selected_cohorts";

type SelectedCohortsValue = {
  selected_cohort_ids?: string[];
};

export async function getSelectedCohortIds(supabase: SupabaseClient): Promise<[string, string] | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", SELECTED_COHORTS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return null;
  const v = data.value as SelectedCohortsValue;
  const ids = (v.selected_cohort_ids ?? []).filter((id) => typeof id === "string" && id.length > 0);
  return ids.length === 2 ? [ids[0], ids[1]] : null;
}

export async function setSelectedCohortIds(
  supabase: SupabaseClient,
  ids: [string, string],
): Promise<void> {
  const { error } = await supabase.from("system_settings").upsert({
    key: SELECTED_COHORTS_KEY,
    value: { selected_cohort_ids: ids },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
