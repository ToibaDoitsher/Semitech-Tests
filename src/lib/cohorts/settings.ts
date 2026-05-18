import type { SupabaseClient } from "@supabase/supabase-js";

export const SELECTED_COHORTS_KEY = "selected_cohorts";

type SelectedCohortsValue = {
  selected_cohorts?: number[];
};

export async function getSelectedCohortNumbers(supabase: SupabaseClient): Promise<number[] | null> {
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", SELECTED_COHORTS_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.value) return null;
  const v = data.value as SelectedCohortsValue;
  const nums = v.selected_cohorts?.filter((n) => Number.isFinite(n)) ?? [];
  return nums.length === 2 ? [nums[0], nums[1]] : null;
}

export async function setSelectedCohortNumbers(
  supabase: SupabaseClient,
  numbers: [number, number],
): Promise<void> {
  const { error } = await supabase.from("system_settings").upsert({
    key: SELECTED_COHORTS_KEY,
    value: { selected_cohorts: numbers },
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
