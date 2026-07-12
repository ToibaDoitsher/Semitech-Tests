import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import { formatGradeLabel } from "@/lib/academicYears/labels";
import { GRADE_LEVELS, type GradeLevel } from "@/lib/academicYears/types";

export type GradeOption = {
  grade_level: GradeLevel;
  label: string;
};

/** @deprecated use GradeOption */
export type YearGradeOption = GradeOption;

export async function listGradeOptions(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<GradeOption[]> {
  const { data, error } = await notDeleted(
    supabase.from("students").select("grade_level"),
  ).eq("academic_year_id", academicYearId);

  // אם העמודה חסרה בסכמה — לא מפילים את כל המסך; מחזירים שכבות ברירת מחדל
  if (error) {
    if (/grade_level/i.test(error.message) && /does not exist/i.test(error.message)) {
      return GRADE_LEVELS.map((grade_level) => ({
        grade_level,
        label: formatGradeLabel(grade_level),
      }));
    }
    throw new Error(error.message);
  }

  const seen = new Set<GradeLevel>();
  const out: GradeOption[] = [];
  for (const row of data ?? []) {
    const grade_level = row.grade_level as GradeLevel;
    if (!seen.has(grade_level)) {
      seen.add(grade_level);
      out.push({ grade_level, label: formatGradeLabel(grade_level) });
    }
  }

  if (out.length > 0) {
    return out.sort((a, b) => a.grade_level.localeCompare(b.grade_level, "he"));
  }

  return GRADE_LEVELS.map((grade_level) => ({
    grade_level,
    label: formatGradeLabel(grade_level),
  }));
}

/** @deprecated use listGradeOptions */
export const listYearGradeOptions = listGradeOptions;
