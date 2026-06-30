import { parseGradeLevel } from "@/lib/academicYears/labels";
import type { AcademicYearScope } from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StudentListFilters = {
  q: string;
  gradeLevel: string;
  classId: string;
  specializationId: string;
  trackId: string;
  psychology: string;
  teachingType: string;
};

export function studentListFiltersFromSearchParams(searchParams: URLSearchParams): StudentListFilters {
  return {
    q: (searchParams.get("q") ?? "").trim(),
    gradeLevel: (searchParams.get("grade_level") ?? "").trim(),
    classId: (searchParams.get("class_id") ?? "").trim(),
    specializationId: (searchParams.get("specialization_id") ?? "").trim(),
    trackId: (searchParams.get("track_id") ?? "").trim(),
    psychology: (searchParams.get("is_psychology") ?? "").trim(),
    teachingType: (searchParams.get("teaching_track_type") ?? "").trim(),
  };
}

export function applyStudentListFilters<T extends { eq: Function; or: Function }>(
  query: T,
  filters: StudentListFilters,
): T {
  let q = query;

  const gl = parseGradeLevel(filters.gradeLevel);
  if (gl) q = q.eq("grade_level", gl) as T;

  if (filters.classId) q = q.eq("class_id", filters.classId) as T;
  if (filters.specializationId) q = q.eq("specialization_id", filters.specializationId) as T;
  if (filters.trackId) q = q.eq("track_id", filters.trackId) as T;
  if (filters.psychology === "1" || filters.psychology === "true") {
    q = q.eq("is_psychology", true) as T;
  }
  if (filters.psychology === "0" || filters.psychology === "false") {
    q = q.eq("is_psychology", false) as T;
  }
  if (filters.teachingType === "full" || filters.teachingType === "short") {
    q = q.eq("teaching_track_type", filters.teachingType) as T;
  }

  const { q: searchQ } = filters;
  if (searchQ) {
    const escapeIlike = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const parts = searchQ.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const p0 = escapeIlike(parts[0]);
      const pRest = escapeIlike(parts.slice(1).join(" "));
      const pLast = escapeIlike(parts[parts.length - 1]);
      const pHead = escapeIlike(parts.slice(0, -1).join(" "));
      q = q.or(
        `and(first_name.ilike.%${p0}%,last_name.ilike.%${pRest}%),and(first_name.ilike.%${pHead}%,last_name.ilike.%${pLast}%)`,
      ) as T;
    } else {
      const escaped = escapeIlike(parts[0] ?? searchQ);
      q = q.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
      ) as T;
    }
  }

  return q;
}

export async function listFilteredStudentIds(
  supabase: SupabaseClient,
  scope: AcademicYearScope,
  filters: StudentListFilters,
): Promise<string[]> {
  let query = notDeleted(supabase.from("students").select("id"))
    .eq("academic_year_id", scope.year.id)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(500);

  query = applyStudentListFilters(query, filters);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}
