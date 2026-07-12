import type { SupabaseClient } from "@supabase/supabase-js";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import type { AcademicYearRow, Term } from "@/lib/academicYears/types";
import { defaultTermForYear, parseTerm } from "@/lib/academicYears/types";

const YEAR_SELECT_FULL =
  "id, year_name, start_date, end_date, is_active, active_term, created_at";
const YEAR_SELECT_NO_TERM = "id, year_name, start_date, end_date, is_active, created_at";
const YEAR_SELECT_LEGACY = "id, year_name, is_active, created_at";

function mapYearRow(row: unknown): AcademicYearRow {
  const r = row as {
    id: string;
    year_name: string;
    start_date?: string | null;
    end_date?: string | null;
    is_active: boolean;
    active_term?: string | null;
    created_at?: string;
  };
  const active_term = parseTerm(r.active_term ?? null) ?? undefined;
  return {
    id: String(r.id),
    year_name: String(r.year_name),
    start_date: r.start_date ?? null,
    end_date: r.end_date ?? null,
    is_active: Boolean(r.is_active),
    active_term,
    created_at: r.created_at,
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
  // לא לעטוף ב-dbSchemaHint כאן — אחרת ה-fallback על active_term נשבר
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapYearRow(row));
}

export async function listAcademicYears(supabase: SupabaseClient): Promise<AcademicYearRow[]> {
  try {
    return await queryAcademicYears(supabase, YEAR_SELECT_FULL);
  } catch (e) {
    const msg = (e as Error).message;
    if (/active_term/i.test(msg)) {
      try {
        return await queryAcademicYears(supabase, YEAR_SELECT_NO_TERM);
      } catch (e2) {
        const msg2 = (e2 as Error).message;
        if (!/start_date|end_date/i.test(msg2)) throw new Error(dbSchemaHint(msg2));
        return await queryAcademicYears(supabase, YEAR_SELECT_LEGACY);
      }
    }
    if (!/start_date|end_date/i.test(msg)) throw new Error(dbSchemaHint(msg));
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
    active_term: "א" as Term,
    start_date: dates?.start_date ?? null,
    end_date: dates?.end_date ?? null,
  };

  let { data, error } = await supabase
    .from("academic_years")
    .insert(insertRow)
    .select(YEAR_SELECT_FULL)
    .single();

  if (error && /active_term/i.test(error.message)) {
    delete insertRow.active_term;
    ({ data, error } = await supabase
      .from("academic_years")
      .insert(insertRow)
      .select(YEAR_SELECT_NO_TERM)
      .single());
  }

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
  return mapYearRow(data);
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

  if (error && /active_term/i.test(error.message)) {
    const retry = await supabase
      .from("academic_years")
      .update({ is_active: true })
      .eq("id", yearId)
      .select(YEAR_SELECT_NO_TERM)
      .single();
    if (retry.error) throw new Error(dbSchemaHint(retry.error.message));
    return mapYearRow(retry.data);
  }

  if (error) throw new Error(dbSchemaHint(error.message));
  return mapYearRow(data);
}

export async function setActiveTerm(
  supabase: SupabaseClient,
  yearId: string,
  term: Term,
): Promise<AcademicYearRow> {
  const { data, error } = await supabase
    .from("academic_years")
    .update({ active_term: term })
    .eq("id", yearId)
    .select(YEAR_SELECT_FULL)
    .single();
  if (error) throw new Error(dbSchemaHint(error.message));
  return mapYearRow(data);
}

export { defaultTermForYear };
