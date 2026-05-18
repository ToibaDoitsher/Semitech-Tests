import type { SupabaseClient } from "@supabase/supabase-js";
import type { AcademicYearRow } from "@/lib/academicYears/types";

export async function listAcademicYears(supabase: SupabaseClient): Promise<AcademicYearRow[]> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, is_active, created_at")
    .order("year_name", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AcademicYearRow[];
}

export async function getActiveAcademicYear(supabase: SupabaseClient): Promise<AcademicYearRow | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, is_active, created_at")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AcademicYearRow | null) ?? null;
}

export async function getAcademicYearById(
  supabase: SupabaseClient,
  id: string,
): Promise<AcademicYearRow | null> {
  const { data, error } = await supabase
    .from("academic_years")
    .select("id, year_name, is_active, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AcademicYearRow | null) ?? null;
}

export async function createAcademicYear(
  supabase: SupabaseClient,
  yearName: string,
  setActive: boolean,
): Promise<AcademicYearRow> {
  const name = yearName.trim();
  if (!name) throw new Error("שם שנה חובה");

  if (setActive) {
    await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("academic_years")
    .insert({ year_name: name, is_active: setActive })
    .select("id, year_name, is_active, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as AcademicYearRow;
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
    .select("id, year_name, is_active, created_at")
    .single();

  if (error) throw new Error(error.message);
  return data as AcademicYearRow;
}
