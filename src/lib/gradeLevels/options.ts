import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import { GRADE_LEVELS, type GradeLevel } from "@/lib/academicYears/types";

export type GradeLevelOptionRow = {
  id: string;
  name: string;
  grade_levels: GradeLevel[];
  is_active: boolean;
};

export function parseGradeLevelsFromName(name: string): GradeLevel[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const parts = trimmed.includes("+")
    ? trimmed.split("+").map((p) => p.trim())
    : [trimmed];
  return parts.filter((p): p is GradeLevel => (GRADE_LEVELS as readonly string[]).includes(p));
}

export async function listGradeLevelOptions(
  supabase: SupabaseClient,
  activeOnly = true,
): Promise<GradeLevelOptionRow[]> {
  let q = supabase
    .from("grade_level_options")
    .select("id, name, grade_levels, is_active")
    .order("name", { ascending: true });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    grade_levels: (row.grade_levels as string[]).filter((g): g is GradeLevel =>
      (GRADE_LEVELS as readonly string[]).includes(g),
    ),
    is_active: row.is_active as boolean,
  }));
}

/** ממזהה(י) אפשרות שכבה (א, ב, ג, א+ב) → רשימת שכבות ייחודית */
export async function resolveGradeLevelsFromOptionIds(
  supabase: SupabaseClient,
  optionIds: string[],
  fallbackGradeLevel?: string | null,
): Promise<{ gradeLevels: GradeLevel[] } | { error: string }> {
  const uniqueOptionIds = [...new Set(optionIds.map((id) => id.trim()).filter(Boolean))];

  if (uniqueOptionIds.length) {
    const gradeLevels: GradeLevel[] = [];
    for (const optionId of uniqueOptionIds) {
      const opt = await getGradeLevelOptionById(supabase, optionId);
      if (!opt?.is_active) {
        return { error: `אפשרות שכבה לא נמצאה (${optionId})` };
      }
      gradeLevels.push(...opt.grade_levels);
    }
    const unique = [...new Set(gradeLevels)];
    if (!unique.length) return { error: "בחרי לפחות שכבה אחת" };
    return { gradeLevels: unique };
  }

  const gl = parseGradeLevel(String(fallbackGradeLevel ?? ""));
  if (!gl) return { error: "בחרי לפחות שכבה אחת" };
  return { gradeLevels: [gl] };
}

export async function getGradeLevelOptionById(
  supabase: SupabaseClient,
  id: string,
): Promise<GradeLevelOptionRow | null> {
  const { data, error } = await supabase
    .from("grade_level_options")
    .select("id, name, grade_levels, is_active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    grade_levels: (data.grade_levels as string[]).filter((g): g is GradeLevel =>
      (GRADE_LEVELS as readonly string[]).includes(g),
    ),
    is_active: data.is_active as boolean,
  };
}
