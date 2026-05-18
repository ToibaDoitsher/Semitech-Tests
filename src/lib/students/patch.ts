import type { SupabaseClient } from "@supabase/supabase-js";
import { isTeachingTrackName } from "@/lib/students/fields";
import type { TeachingTrackType } from "@/lib/types/db";

export type StudentFieldInput = {
  specialization_id?: string | null;
  secondary_specialization_id?: string | null;
  track_id?: string | null;
  is_psychology?: boolean;
  teaching_track_type?: TeachingTrackType | null | "";
};

export async function normalizeStudentFields(
  supabase: SupabaseClient,
  input: StudentFieldInput,
): Promise<{ patch: Record<string, unknown>; error: string | null }> {
  const specId = input.specialization_id === "" || input.specialization_id == null ? null : input.specialization_id;
  const secSpecId =
    input.secondary_specialization_id === "" || input.secondary_specialization_id == null
      ? null
      : input.secondary_specialization_id;
  const trackId = input.track_id === "" || input.track_id == null ? null : input.track_id;
  const isPsychology = Boolean(input.is_psychology);
  let teachingType =
    input.teaching_track_type === "" || input.teaching_track_type == null
      ? null
      : input.teaching_track_type;

  if (specId && secSpecId && specId === secSpecId) {
    return { patch: {}, error: "התמחות נוספת חייבת להיות שונה מהראשית" };
  }

  if (!trackId) {
    teachingType = null;
  } else {
    const { data: tr } = await supabase.from("tracks").select("name").eq("id", trackId).maybeSingle();
    if (!isTeachingTrackName((tr?.name as string) ?? null)) {
      teachingType = null;
    }
  }

  return {
    patch: {
      specialization_id: specId,
      secondary_specialization_id: secSpecId,
      track_id: trackId,
      is_psychology: isPsychology,
      teaching_track_type: teachingType,
    },
    error: null,
  };
}
