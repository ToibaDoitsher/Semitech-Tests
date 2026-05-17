import type { SupabaseClient } from "@supabase/supabase-js";
import { setAcademicYearCookie } from "@/lib/academic/year";
import type { GradeLevel } from "@/lib/students/gradeLevel";

export type OpenYearInput = {
  name: string;
  newCohortNumber: number;
};

export type OpenYearResult = {
  yearId: string;
  yearName: string;
  newCohortNumber: number;
  promotedCount: number;
};

export async function openAcademicYear(
  supabase: SupabaseClient,
  input: OpenYearInput,
): Promise<{ result?: OpenYearResult; error?: string }> {
  const name = input.name.trim();
  const newCohortNumber = input.newCohortNumber;

  if (!name) return { error: "חובה שם שנת לימודים" };
  if (!Number.isFinite(newCohortNumber) || newCohortNumber < 1) {
    return { error: "מספר מחזור חדש לא תקין" };
  }

  const { data: existing } = await supabase.from("academic_years").select("id").eq("name", name).maybeSingle();
  if (existing) return { error: "שנת לימודים כבר קיימת" };

  const { data: prevYear } = await supabase
    .from("academic_years")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  await supabase.from("academic_years").update({ is_active: false }).eq("is_active", true);

  const { data: created, error: insErr } = await supabase
    .from("academic_years")
    .insert({ name, is_active: true })
    .select("id, name")
    .single();

  if (insErr || !created) return { error: insErr?.message ?? "שגיאה ביצירת שנה" };

  const yearId = created.id as string;
  let promotedCount = 0;

  if (prevYear?.id) {
    const { data: promoted, error: promoteErr } = await supabase
      .from("students")
      .update({ grade_level: "ב" as GradeLevel, academic_year_id: yearId })
      .eq("academic_year_id", prevYear.id)
      .eq("grade_level", "א" satisfies GradeLevel)
      .select("id");

    if (promoteErr) return { error: `קידום שכבה א׳→ב׳: ${promoteErr.message}` };
    promotedCount = promoted?.length ?? 0;
  }

  await setAcademicYearCookie(yearId);

  return {
    result: {
      yearId,
      yearName: name,
      newCohortNumber,
      promotedCount,
    },
  };
}
