import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildCohortPairView,
  cohortDisplayNumber,
  cohortWithGradeLabel,
} from "@/lib/cohorts/grades";
import { getSelectedCohortNumbers, setSelectedCohortNumbers } from "@/lib/cohorts/settings";
import type { CohortPairView, CohortRow, GradeLevel } from "@/lib/cohorts/types";

export type { CohortRow, CohortPairView, GradeLevel } from "@/lib/cohorts/types";
export {
  cohortDisplayNumber as cohortLabel,
  cohortWithGradeLabel,
  buildCohortPairView,
  gradeInPair,
  gradeForCohort,
} from "@/lib/cohorts/grades";
export { buildPairOptions } from "@/lib/cohorts/grades";

const COHORT_SELECT = "id, name, number, display_order";

export async function listAllCohorts(supabase: SupabaseClient): Promise<CohortRow[]> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .order("number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(normalizeCohort);
}

export async function loadDefaultCohortPair(supabase: SupabaseClient): Promise<CohortPairView | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .in("display_order", [1, 2]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(normalizeCohort);
  if (rows.length < 2) return null;
  return buildCohortPairView(rows[0], rows[1]);
}

/** @deprecated use loadDefaultCohortPair */
export const loadActiveCohortPair = loadDefaultCohortPair;

export async function loadCohortPairByNumbers(
  supabase: SupabaseClient,
  numA: number,
  numB: number,
): Promise<CohortPairView | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .in("number", [numA, numB]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(normalizeCohort);
  if (rows.length !== 2) return null;
  return buildCohortPairView(rows[0], rows[1]);
}

export async function loadCohortPairByIds(
  supabase: SupabaseClient,
  idA: string,
  idB: string,
): Promise<CohortPairView | null> {
  const { data, error } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .in("id", [idA, idB]);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(normalizeCohort);
  if (rows.length !== 2) return null;
  return buildCohortPairView(rows[0], rows[1]);
}

export async function selectedCohortIds(pair: CohortPairView): Promise<[string, string]> {
  return [pair.cohortA.id, pair.cohortB.id];
}

export async function findCohortByNumber(supabase: SupabaseClient, num: number) {
  const { data, error } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .eq("number", num)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? normalizeCohort(data) : null;
}

export async function createCohortByNumber(supabase: SupabaseClient, num: number, name?: string) {
  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      number: num,
      name: name ?? String(num),
    })
    .select(COHORT_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return normalizeCohort(data);
}

export async function createNewCohort(
  supabase: SupabaseClient,
  newCohortNumber: number,
): Promise<{
  result?: { cohortAName: string; cohortBName: string; archivedName: string | null };
  error?: string;
}> {
  if (!Number.isFinite(newCohortNumber) || newCohortNumber < 1) {
    return { error: "מספר מחזור לא תקין" };
  }

  const { data: layers, error: layersErr } = await supabase
    .from("cohorts")
    .select(COHORT_SELECT)
    .in("display_order", [1, 2]);
  if (layersErr) return { error: layersErr.message };

  const layerRows = (layers ?? []).map(normalizeCohort);
  const prevLayerA = layerRows.find((c) => c.display_order === 1) ?? null;
  const prevLayerB = layerRows.find((c) => c.display_order === 2) ?? null;

  let newCohort = await findCohortByNumber(supabase, newCohortNumber);
  if (!newCohort) newCohort = await createCohortByNumber(supabase, newCohortNumber);

  if (prevLayerB?.id) {
    const { error } = await supabase
      .from("cohorts")
      .update({ display_order: null })
      .eq("id", prevLayerB.id);
    if (error) return { error: error.message };
  }

  if (prevLayerA?.id) {
    const { error } = await supabase
      .from("cohorts")
      .update({ display_order: 2 })
      .eq("id", prevLayerA.id);
    if (error) return { error: error.message };
  }

  const { error: newErr } = await supabase
    .from("cohorts")
    .update({ display_order: 1 })
    .eq("id", newCohort.id);
  if (newErr) return { error: newErr.message };

  if (prevLayerA) {
    await setSelectedCohortNumbers(supabase, [newCohortNumber, prevLayerA.number]);
  }

  return {
    result: {
      cohortAName: cohortWithGradeLabel({ ...newCohort, display_order: 1 }),
      cohortBName: prevLayerA ? cohortWithGradeLabel({ ...prevLayerA, display_order: 2 }) : "—",
      archivedName: prevLayerB ? cohortDisplayNumber(prevLayerB) : null,
    },
  };
}

/** @deprecated use createNewCohort */
export const openNewCohort = createNewCohort;

function normalizeCohort(row: Record<string, unknown>): CohortRow {
  const order = row.display_order;
  return {
    id: row.id as string,
    name: (row.name as string | null) ?? null,
    number: Number(row.number),
    display_order: order == null ? null : Number(order),
  };
}
