import type { SupabaseClient } from "@supabase/supabase-js";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import type { AcademicYearRow } from "@/lib/academicYears/types";

const YEAR_SELECT_FULL = "id, year_name, start_date, end_date, is_active, created_at";
const YEAR_SELECT_LEGACY = "id, year_name, is_active, created_at";

function mapYearRow(row: Record<string, unknown>): AcademicYearRow {
  return {
    id: String(row.id),
    year_name: String(row.year_name),
    start_date: (row.start_date as string | null | undefined) ?? null,
    end_date: (row.end_date as string | null | undefined) ?? null,
    is_active: Boolean(row.is_active),
    created_at: row.created_at as string | undefined,
  };
}

async function queryAcademicYears(
  supabase: SupabaseClient,
  select: string,
): Promise<AcademicYearRow[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select(select)
    .order("year_name", { ascending: false });
  if (error) throw new Error(dbSchemaHint(error.message));
  return (data ?? []).map((row) => mapYearRow(row as Record<string, unknown>));
}

export async function listAcademicYears(supabase: SupabaseClient): Promise<AcademicYearRow[]> {
  try {
    return await queryAcademicYears(supabase, YEAR_SELECT_FULL);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/start_date|end_date/i.test(msg)) throw e;
    return await queryAcademicYears(supabase, YEAR_SELECT_LEGACY);
  }
}

export async function getActiveAcademicYear(supabase: SupabaseClient): Promise<AcademicYearRow | null> {
  const years = await listAcademicYears(supabase);
  if (!years.length) return null;
  return years.find((y) => y.is_active) ?? years[0];
}

export async function getAcademicYearById(
  supabase: SupabaseClient,
  id: string,
): Promise<AcademicYearRow | null> {
  const years = await listAcademicYears(supabase);
  return years.find((y) => y.id === id) ?? null;
}

export async function createAcademicYear(
  supabase: SupabaseClient,
  yearName: string,
  setActive: boolean,
  dates?: { start_date?: string | null; end_date?: string | null },
): Promise<AcademicYearRow> {
  const name = yearName.trim();
  if (!name) throw new Error("שם שנה חובה");

  if (setActive) {
    await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  }

  const insertRow: Record<string, unknown> = {
    year_name: name,
    is_active: setActive,
    start_date: dates?.start_date ?? null,
    end_date: dates?.end_date ?? null,
  };

  let { data, error } = await supabase
    .from("academic_years")
    .insert(insertRow)
    .select(YEAR_SELECT_FULL)
    .single();

  if (error && /start_date|end_date/i.test(error.message)) {
    delete insertRow.start_date;
    delete insertRow.end_date;
    ({ data, error } = await supabase
      .from("academic_years")
      .insert(insertRow)
      .select(YEAR_SELECT_LEGACY)
      .single());
  }

  if (error) throw new Error(dbSchemaHint(error.message));
  return mapYearRow(data as Record<string, unknown>);
}

export async function setActiveAcademicYear(
  supabase: SupabaseClient,
  yearId: string,
): Promise<AcademicYearRow> {
  const row = await getAcademicYearById(supabase, yearId);
  if (!row) throw new Error("שנה לא נמצאה");

  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabase
    .from("academic_years")
    .update({ is_active: true })
    .eq("id", yearId)
    .select(YEAR_SELECT_FULL)
    .single();

  if (error) throw new Error(dbSchemaHint(error.message));
  return mapYearRow(data as Record<string, unknown>);
}
