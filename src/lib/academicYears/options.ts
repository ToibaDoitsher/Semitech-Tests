import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import { formatYearGradeLabel } from "@/lib/academicYears/labels";
import { GRADE_LEVELS, type GradeLevel } from "@/lib/academicYears/types";

export type YearGradeOption = {
  year_group: number;
  grade_level: GradeLevel;
  label: string;
};

export async function listYearGradeOptions(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<YearGradeOption[]> {
  const { data, error } = await notDeleted(
    supabase.from("students").select("year_group, grade_level"),
  ).eq("academic_year_id", academicYearId);

  if (error) throw new Error(error.message);

  const seen = new Map<string, YearGradeOption>();
  for (const row of data ?? []) {
    const year_group = row.year_group as number;
    const grade_level = row.grade_level as GradeLevel;
    const key = `${year_group}:${grade_level}`;
    if (!seen.has(key)) {
      seen.set(key, {
        year_group,
        grade_level,
        label: formatYearGradeLabel(year_group, grade_level),
      });
    }
  }

  if (seen.size > 0) {
    return [...seen.values()].sort((a, b) => a.grade_level.localeCompare(b.grade_level, "he"));
  }

  return GRADE_LEVELS.map((grade_level, i) => {
    const year_group = 11 - i;
    return {
      year_group,
      grade_level,
      label: formatYearGradeLabel(year_group, grade_level),
    };
  });
}
