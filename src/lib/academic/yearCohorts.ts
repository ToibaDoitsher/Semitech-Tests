import type { SupabaseClient } from "@supabase/supabase-js";
import { cohortLabelFromRow, findCohortByLabel, getCohortNameColumn, type CohortRow } from "@/lib/cohorts/db";

type YearCohortSchema = "columns" | "placements";

let cachedYearCohortSchema: YearCohortSchema | null = null;

function isMissingCohortColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("cohort_a_id") &&
    (m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find"))
  );
}

async function detectYearCohortSchema(supabase: SupabaseClient): Promise<YearCohortSchema> {
  if (cachedYearCohortSchema) return cachedYearCohortSchema;
  const probe = await supabase.from("academic_years").select("cohort_a_id").limit(1);
  if (!probe.error) {
    cachedYearCohortSchema = "columns";
  } else if (isMissingCohortColumnError(probe.error.message)) {
    cachedYearCohortSchema = "placements";
  } else {
    cachedYearCohortSchema = "placements";
  }
  return cachedYearCohortSchema;
}

export type CohortGrade = "A" | "B";

export type YearCohortConfig = {
  id: string;
  name: string;
  cohort_a_id: string | null;
  cohort_b_id: string | null;
  cohort_a_name: string | null;
  cohort_b_name: string | null;
};

export function gradeForCohortInYear(
  cohortId: string | null | undefined,
  year: Pick<YearCohortConfig, "cohort_a_id" | "cohort_b_id">,
): CohortGrade | null {
  if (!cohortId) return null;
  if (year.cohort_a_id === cohortId) return "A";
  if (year.cohort_b_id === cohortId) return "B";
  return null;
}

export function buildGradeMapFromYear(year: Pick<YearCohortConfig, "cohort_a_id" | "cohort_b_id">): Map<string, CohortGrade> {
  const map = new Map<string, CohortGrade>();
  if (year.cohort_a_id) map.set(year.cohort_a_id, "A");
  if (year.cohort_b_id) map.set(year.cohort_b_id, "B");
  return map;
}

async function cohortNamesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const col = await getCohortNameColumn(supabase);
  const { data, error } = await supabase.from("cohorts").select(`id, ${col}`).in("id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((r) => [r.id as string, cohortLabelFromRow(r as CohortRow)]));
}

async function loadYearCohortConfigFromPlacements(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<YearCohortConfig | null> {
  const { data: year, error: yearErr } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("id", academicYearId)
    .maybeSingle();
  if (yearErr) throw new Error(yearErr.message);
  if (!year) return null;

  const { data: placements, error: pErr } = await supabase
    .from("cohort_year_placements")
    .select("cohort_id, grade_level")
    .eq("academic_year_id", academicYearId);
  if (pErr) {
    if (pErr.message.includes("cohort_year_placements") && pErr.message.includes("does not exist")) {
      return rowToConfig(
        { id: year.id as string, name: year.name as string, cohort_a_id: null, cohort_b_id: null },
        new Map(),
      );
    }
    throw new Error(pErr.message);
  }

  let cohort_a_id: string | null = null;
  let cohort_b_id: string | null = null;
  for (const p of placements ?? []) {
    const gl = String((p as { grade_level: string }).grade_level);
    if (gl === "A") cohort_a_id = (p as { cohort_id: string }).cohort_id;
    if (gl === "B") cohort_b_id = (p as { cohort_id: string }).cohort_id;
  }

  const ids = [cohort_a_id, cohort_b_id].filter((x): x is string => Boolean(x));
  const names = await cohortNamesByIds(supabase, ids);
  return rowToConfig(
    { id: year.id as string, name: year.name as string, cohort_a_id, cohort_b_id },
    names,
  );
}

function rowToConfig(
  row: { id: string; name: string; cohort_a_id: string | null; cohort_b_id: string | null },
  names: Map<string, string>,
): YearCohortConfig {
  return {
    id: row.id,
    name: row.name,
    cohort_a_id: row.cohort_a_id,
    cohort_b_id: row.cohort_b_id,
    cohort_a_name: row.cohort_a_id ? names.get(row.cohort_a_id) ?? null : null,
    cohort_b_name: row.cohort_b_id ? names.get(row.cohort_b_id) ?? null : null,
  };
}

async function loadYearCohortConfigFromColumns(
  supabase: SupabaseClient,
  filter: { column: "id" | "name"; value: string },
): Promise<YearCohortConfig | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, name, cohort_a_id, cohort_b_id")
    .eq(filter.column, filter.value)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const ids = [data.cohort_a_id, data.cohort_b_id].filter((x): x is string => Boolean(x));
  const names = await cohortNamesByIds(supabase, ids);
  return rowToConfig(data as { id: string; name: string; cohort_a_id: string | null; cohort_b_id: string | null }, names);
}

export async function loadYearCohortConfig(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<YearCohortConfig | null> {
  const schema = await detectYearCohortSchema(supabase);
  if (schema === "placements") {
    return loadYearCohortConfigFromPlacements(supabase, academicYearId);
  }
  try {
    return await loadYearCohortConfigFromColumns(supabase, { column: "id", value: academicYearId });
  } catch (e) {
    if (isMissingCohortColumnError((e as Error).message)) {
      cachedYearCohortSchema = "placements";
      return loadYearCohortConfigFromPlacements(supabase, academicYearId);
    }
    throw e;
  }
}

export async function loadYearCohortConfigByName(
  supabase: SupabaseClient,
  yearName: string,
): Promise<YearCohortConfig | null> {
  const schema = await detectYearCohortSchema(supabase);
  if (schema === "placements") {
    const { data: year, error } = await supabase
      .from("academic_years")
      .select("id")
      .eq("name", yearName.trim())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!year) return null;
    return loadYearCohortConfigFromPlacements(supabase, year.id as string);
  }
  try {
    return await loadYearCohortConfigFromColumns(supabase, { column: "name", value: yearName.trim() });
  } catch (e) {
    if (isMissingCohortColumnError((e as Error).message)) {
      cachedYearCohortSchema = "placements";
      const { data: year, error } = await supabase
        .from("academic_years")
        .select("id")
        .eq("name", yearName.trim())
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!year) return null;
      return loadYearCohortConfigFromPlacements(supabase, year.id as string);
    }
    throw e;
  }
}

export async function resolveImportTarget(
  supabase: SupabaseClient,
  yearName: string,
  cohortName: string,
): Promise<{ yearId: string; cohortId: string; grade: CohortGrade | null; year: YearCohortConfig; error?: string }> {
  const year = await loadYearCohortConfigByName(supabase, yearName);
  if (!year) {
    return {
      yearId: "",
      cohortId: "",
      grade: null,
      year: { id: "", name: yearName, cohort_a_id: null, cohort_b_id: null, cohort_a_name: null, cohort_b_name: null },
      error: `שנת לימודים "${yearName}" לא קיימת — פתחי שנת לימודים חדשה תחילה`,
    };
  }
  if (!year.cohort_a_id || !year.cohort_b_id) {
    return {
      yearId: year.id,
      cohortId: "",
      grade: null,
      year,
      error: "לשנה זו לא הוגדרו מחזורי שכבה א׳ וב׳",
    };
  }

  const cohort = await findCohortByLabel(supabase, cohortName);
  if (!cohort) {
    return {
      yearId: year.id,
      cohortId: "",
      grade: null,
      year,
      error: `מחזור "${cohortName}" לא קיים`,
    };
  }

  const grade = gradeForCohortInYear(cohort.id, year);
  if (!grade) {
    return {
      yearId: year.id,
      cohortId: cohort.id,
      grade: null,
      year,
      error: `מחזור ${cohortName} לא משויך לשנת ${yearName} (א׳: ${year.cohort_a_name ?? "—"}, ב׳: ${year.cohort_b_name ?? "—"})`,
    };
  }

  return { yearId: year.id, cohortId: cohort.id, grade, year };
}
