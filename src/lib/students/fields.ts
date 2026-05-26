import type { TeachingTrackType } from "@/lib/types/db";

export const TEACHING_TRACK_NAME = "הוראה";

export type { TeachingTrackType };

export function isTeachingTrackName(name: string | null | undefined): boolean {
  return (name ?? "").trim() === TEACHING_TRACK_NAME;
}

export function teachingTrackTypeLabel(t: TeachingTrackType | null | undefined): string {
  if (t === "full") return "מלא";
  if (t === "short") return "מקוצר";
  return "—";
}

export function parseTeachingTrackTypeCell(raw: string): TeachingTrackType | null {
  const v = raw.trim();
  if (!v) return null;
  if (v === "מלא" || v.toLowerCase() === "full" || v === "הוראה מלאה") return "full";
  if (v === "מקוצר" || v.toLowerCase() === "short" || v === "הוראה מקוצר") return "short";
  if (v === "כן" || v.toLowerCase() === "yes" || v === "true") return "short";
  if (v === "לא" || v.toLowerCase() === "no" || v === "false") return null;
  return null;
}

export function parsePsychologyCell(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (!v) return false;
  if (["כן", "yes", "true", "1", "y"].includes(v)) return true;
  if (["לא", "no", "false", "0", "n"].includes(v)) return false;
  return v === "true";
}

/** לייבוא שיבוצים — כולל «מלא + מקוצר» */
export function parseTeachingModeCell(raw: string): import("@/lib/types/db").TeachingMode | null {
  const v = raw.trim();
  if (!v) return null;
  const track = parseTeachingTrackTypeCell(v);
  if (track) return track;
  if (v === "מלא + מקוצר" || v.toLowerCase() === "both" || v === "שניהם") return "both";
  return null;
}
