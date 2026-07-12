import type { SupabaseClient } from "@supabase/supabase-js";
import { getAcademicYearById, getActiveAcademicYear } from "@/lib/academicYears/years";
import {
  defaultTermForYear,
  parseTerm,
  type AcademicYearRow,
  type Term,
} from "@/lib/academicYears/types";
import { dbSchemaHint } from "@/lib/db/schemaHint";

export type AcademicYearScope = {
  year: AcademicYearRow;
  readOnly: boolean;
  /** מחצית נצפית בתוך השנה */
  term: Term;
};

/** מזהה שנה לעבודה: פרמטר academic_year_id או השנה הפעילה */
export async function resolveAcademicYearScope(
  supabase: SupabaseClient,
  academicYearIdParam: string | null | undefined,
  termParam?: string | null | undefined,
): Promise<AcademicYearScope> {
  try {
    const active = await getActiveAcademicYear(supabase);
    if (!active) {
      throw new Error(
        "לא הוגדרה שנה לימודים — היכנסי להגדרות → שנות לימוד וצרי שנה, או הריצי supabase/RUN_FULL_DATABASE_RESET.sql",
      );
    }

    const id = academicYearIdParam?.trim();
    let year: AcademicYearRow;
    let readOnly: boolean;
    if (!id || id === active.id) {
      year = active;
      readOnly = false;
    } else {
      const archived = await getAcademicYearById(supabase, id);
      if (!archived) throw new Error("שנה לא נמצאה");
      year = archived;
      readOnly = true;
    }

    const fromParam = parseTerm(termParam);
    const term = fromParam ?? defaultTermForYear(year);
    return { year, readOnly, term };
  } catch (e) {
    throw new Error(dbSchemaHint((e as Error).message));
  }
}

export function scopeFromSearchParams(
  searchParams: URLSearchParams,
): string | null {
  return searchParams.get("academic_year_id");
}

export function termFromSearchParams(searchParams: URLSearchParams): string | null {
  return searchParams.get("term");
}

/** פותר scope כולל מחצית מ־URL */
export async function resolveScopeFromUrl(
  supabase: SupabaseClient,
  searchParams: URLSearchParams,
): Promise<AcademicYearScope> {
  return resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(searchParams),
    termFromSearchParams(searchParams),
  );
}

export function readOnlyResponse(): { error: string } {
  return { error: "שנה בארכיון — צפייה בלבד" };
}
