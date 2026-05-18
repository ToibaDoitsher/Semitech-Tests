import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeachingTrackName } from "@/lib/students/fields";
import type { TeachingMode } from "@/lib/types/db";

export async function resolveAssignmentTeachingMode(
  supabase: SupabaseClient,
  trackId: string | null | undefined,
  teachingMode: string | null | undefined,
): Promise<{ teaching_mode: TeachingMode | null; error: string | null }> {
  const mode = (teachingMode ?? "").trim() as TeachingMode | "";
  if (!mode) return { teaching_mode: null, error: null };

  if (mode !== "full" && mode !== "short") {
    return { teaching_mode: null, error: "סוג הוראה לא תקין" };
  }

  if (!trackId) {
    return { teaching_mode: null, error: "סוג הוראה מותר רק בשיבוץ מסלול" };
  }

  const { data: trackRow } = await supabase.from("tracks").select("name").eq("id", trackId).maybeSingle();
  if (!isTeachingTrackName((trackRow?.name as string) ?? "")) {
    return { teaching_mode: null, error: "סוג הוראה מותר רק במסלול הוראה" };
  }

  return { teaching_mode: mode, error: null };
}
