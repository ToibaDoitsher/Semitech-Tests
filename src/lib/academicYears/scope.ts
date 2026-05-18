import type { SupabaseClient } from "@supabase/supabase-js";
import { getAcademicYearById, getActiveAcademicYear } from "@/lib/academicYears/years";
import type { AcademicYearRow } from "@/lib/academicYears/types";

export type AcademicYearScope = {
  year: AcademicYearRow;
  readOnly: boolean;
};

/** מזהה שנה לעבודה: פרמטר academic_year_id או השנה הפעילה */
export async function resolveAcademicYearScope(
  supabase: SupabaseClient,
  academicYearIdParam: string | null | undefined,
): Promise<AcademicYearScope> {
  const active = await getActiveAcademicYear(supabase);
  if (!active) {
    throw new Error("לא הוגדרה שנה פעילה — צרי שנה חדשה בהגדרות");
  }

  const id = academicYearIdParam?.trim();
  if (!id || id === active.id) {
    return { year: active, readOnly: false };
  }

  const archived = await getAcademicYearById(supabase, id);
  if (!archived) throw new Error("שנה לא נמצאה");
  return { year: archived, readOnly: true };
}

export function scopeFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  return searchParams.get("academic_year_id");
}

export function readOnlyResponse(): { error: string } {
  return { error: "שנה בארכיון — צפייה בלבד" };
}
