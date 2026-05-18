"use client";

import { useState } from "react";
import { TEACHING_TRACK_NAME } from "@/lib/students/fields";

type Lookup = { id: string; name: string };

export function StudentFormExtras({
  specializations,
  tracks,
  defaultSecondarySpecId = "",
  defaultIsPsychology = false,
  defaultTeachingType = "",
  defaultTrackId = "",
}: {
  specializations: Lookup[];
  tracks: Lookup[];
  defaultSecondarySpecId?: string;
  defaultIsPsychology?: boolean;
  defaultTeachingType?: string;
  defaultTrackId?: string;
}) {
  const [trackId, setTrackId] = useState(defaultTrackId);
  const trackName = tracks.find((t) => t.id === trackId)?.name ?? "";
  const showTeaching = trackName === TEACHING_TRACK_NAME;

  return (
    <>
      <label className="block text-sm">
        <span className="font-medium">מסלול</span>
        <select
          name="track_id"
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
        >
          <option value="">—</option>
          {tracks.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">התמחות נוספת</span>
        <select
          name="secondary_specialization_id"
          defaultValue={defaultSecondarySpecId}
          className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
        >
          <option value="">—</option>
          {specializations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="is_psychology" value="1" defaultChecked={defaultIsPsychology} />
        <span className="font-medium">פסיכולוגיה</span>
      </label>
      {showTeaching ? (
        <label className="block text-sm">
          <span className="font-medium">סוג הוראה ({TEACHING_TRACK_NAME})</span>
          <select
            name="teaching_track_type"
            defaultValue={defaultTeachingType}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2"
          >
            <option value="">—</option>
            <option value="full">מלא</option>
            <option value="short">מקוצר</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="teaching_track_type" value="" />
      )}
    </>
  );
}
