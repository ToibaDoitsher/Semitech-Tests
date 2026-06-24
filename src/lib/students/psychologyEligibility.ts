import type { SupabaseClient } from "@supabase/supabase-js";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";

/** מסלולים שמחייבים מבחן פסיכולוגיה (בנוסף לסימון «פסיכולוגיה» על התלמידה) */
export const PSYCHOLOGY_REQUIRED_TRACK_NAMES = [
  TEACHING_TRACK_NAME,
  "הוראת מדעי המחשב",
] as const;

export type PsychologyEligibilityContext = {
  psychologyTrackIds: Set<string>;
};

export type StudentPsychologyFields = {
  is_psychology: boolean;
  track_id: string | null;
};

function normalizeTrackName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** האם המסלול הוא «הוראה» או «הוראת מדעי המחשב» */
export function isPsychologyRequiredTrackName(name: string | null | undefined): boolean {
  const n = normalizeTrackName(name ?? "");
  if (!n) return false;
  if ((PSYCHOLOGY_REQUIRED_TRACK_NAMES as readonly string[]).includes(n)) return true;
  return n.includes("מדעי המחשב") && n.includes("הורא");
}

export async function fetchPsychologyRequiredTrackIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data } = await supabase.from("tracks").select("id, name");
  const out = new Set<string>();
  for (const row of data ?? []) {
    const r = row as { id: string; name: string };
    if (isPsychologyRequiredTrackName(r.name)) out.add(r.id);
  }
  return out;
}

export async function loadPsychologyEligibilityContext(
  supabase: SupabaseClient,
): Promise<PsychologyEligibilityContext> {
  const psychologyTrackIds = await fetchPsychologyRequiredTrackIds(supabase);
  return { psychologyTrackIds };
}

/**
 * מי זכאית למבחן פסיכולוגיה:
 * - סומנה «פסיכולוגיה» על התלמידה, או
 * - במסלול «הוראה» או «הוראת מדעי המחשב»
 */
export function studentQualifiesForPsychologyExam(
  student: StudentPsychologyFields,
  ctx: PsychologyEligibilityContext,
): boolean {
  if (student.is_psychology) return true;
  if (!student.track_id) return false;
  return ctx.psychologyTrackIds.has(student.track_id);
}

export function studentQualifiesForPsychologyExamLegacy(student: StudentPsychologyFields): boolean {
  return Boolean(student.is_psychology);
}
