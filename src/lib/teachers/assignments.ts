import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeachingTrackName } from "@/lib/students/fields";
import {
  isTeachingModeValue,
  teachingModeToAssignmentDb,
  type TeachingModeSelection,
} from "@/lib/teachers/teachingMode";
import type { TeachingTrackType } from "@/lib/types/db";

export async function resolveAssignmentTeachingMode(
  supabase: SupabaseClient,
  trackId: string | null | undefined,
  teachingMode: string | null | undefined,
): Promise<{ teaching_mode: TeachingTrackType | null; error: string | null }> {
  const mode = (teachingMode ?? "").trim();
  if (!mode) return { teaching_mode: null, error: null };

  if (!isTeachingModeValue(mode)) {
    return { teaching_mode: null, error: "סוג הוראה לא תקין" };
  }

  if (!trackId) {
    return { teaching_mode: null, error: "סוג הוראה מותר רק בשיבוץ מסלול" };
  }

  const { data: trackRow } = await supabase.from("tracks").select("name").eq("id", trackId).maybeSingle();
  if (!isTeachingTrackName((trackRow?.name as string) ?? "")) {
    return { teaching_mode: null, error: "סוג הוראה מותר רק במסלול הוראה" };
  }

  return {
    teaching_mode: teachingModeToAssignmentDb(mode as TeachingModeSelection),
    error: null,
  };
}
