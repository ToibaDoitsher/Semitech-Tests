import { TEACHING_TRACK_NAME } from "@/lib/students/fields";
import type { TeachingMode, TeachingTrackType } from "@/lib/types/db";

/** בחירה בממשק — ריק = טרם נבחר */
export type TeachingModeSelection = TeachingMode | "";

export function isTeachingTrackIdMatch(
  trackIds: string[],
  teachingTrackId: string,
): boolean {
  return trackIds.length === 1 && Boolean(teachingTrackId) && trackIds[0] === teachingTrackId;
}

export function findTeachingTrackId(
  tracks: { id: string; name: string }[],
): string {
  return tracks.find((t) => t.name === TEACHING_TRACK_NAME)?.id ?? "";
}

export function isTeachingModeValue(
  mode: string | null | undefined,
): mode is TeachingMode {
  return mode === "full" || mode === "short" || mode === "both";
}

export function isTeachingSelectionComplete(
  selection: TeachingModeSelection | null | undefined,
): selection is TeachingMode {
  return isTeachingModeValue(selection);
}

export function isTeachingModeSelection(raw: string | null | undefined): raw is TeachingMode {
  return isTeachingModeValue(raw);
}

/** שיבוץ — teaching_mode: full / short / both */
export function teachingModeToAssignmentDb(
  selection: TeachingModeSelection,
): TeachingMode | null {
  if (isTeachingModeValue(selection)) return selection;
  return null;
}

/**
 * מבחן — teaching_track_type במסד: רק full / short / null.
 * «מלא + מקוצר» נשמר כ-null (סינון לפי סוג התלמידה — מלא ומקוצר).
 */
export function teachingModeToExamDb(
  selection: TeachingModeSelection,
): TeachingTrackType | null {
  if (selection === "full" || selection === "short") return selection;
  return null;
}

export function teachingModeFromAssignmentDb(
  mode: TeachingMode | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection {
  if (isTeachingModeValue(mode)) return mode;
  if (isTeachingTrack) return "";
  return "";
}

/**
 * מבחן — null על מסלול הוראה = «מלא + מקוצר» (ללא סינון לפי סוג תלמידה).
 */
export function teachingModeFromExamDb(
  examType: TeachingTrackType | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection {
  if (examType === "full" || examType === "short") return examType;
  if (isTeachingTrack && examType == null) return "both";
  return "";
}

export function examTeachingTypeFromAssignment(
  teachingMode: TeachingMode | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection | null {
  if (!isTeachingTrack) return null;
  return teachingModeFromAssignmentDb(teachingMode, true);
}

/** @deprecated use teachingModeToExamDb / teachingModeToAssignmentDb */
export function teachingModeFromDb(
  mode: TeachingMode | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection {
  return teachingModeFromAssignmentDb(mode, isTeachingTrack);
}

/** @deprecated use teachingModeToExamDb / teachingModeToAssignmentDb */
export function teachingModeToDb(selection: TeachingModeSelection): TeachingMode | null {
  return teachingModeToAssignmentDb(selection);
}

export function examTeachingTypeForSubmit(
  selection: TeachingModeSelection | null,
): TeachingTrackType | null {
  return teachingModeToExamDb(selection ?? "");
}

export function examTeachingModeForSubmit(
  selection: TeachingModeSelection | null,
): TeachingMode | null {
  return teachingModeToAssignmentDb(selection ?? "");
}

/** לסינון תלמידות בעת סנכרון מבחן — null במסד על מסלול הוראה = both */
export function teachingModeForExamStudentFilter(
  examType: TeachingTrackType | null | undefined,
  hasTeachingTrack: boolean,
): TeachingMode | null {
  if (examType === "full" || examType === "short") return examType;
  if (hasTeachingTrack && examType == null) return "both";
  return null;
}
