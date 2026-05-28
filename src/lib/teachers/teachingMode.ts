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

/** שיבוץ — teaching_mode במסד: full / short / null (null = מלא+מקוצר) */
export function teachingModeToAssignmentDb(
  selection: TeachingModeSelection,
): TeachingTrackType | null {
  if (selection === "full" || selection === "short") return selection;
  if (selection === "both") return null;
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
  mode: TeachingTrackType | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection {
  if (mode === "full" || mode === "short") return mode;
  if (isTeachingTrack && mode == null) return "both";
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
  teachingMode: TeachingTrackType | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection | null {
  if (!isTeachingTrack) return null;
  return teachingModeFromAssignmentDb(teachingMode, true);
}

/** @deprecated use teachingModeToExamDb / teachingModeToAssignmentDb */
export function teachingModeFromDb(
  mode: TeachingTrackType | null | undefined,
  isTeachingTrack: boolean,
): TeachingModeSelection {
  return teachingModeFromAssignmentDb(mode, isTeachingTrack);
}

/** @deprecated use teachingModeToExamDb / teachingModeToAssignmentDb */
export function teachingModeToDb(selection: TeachingModeSelection): TeachingTrackType | null {
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
  if (isTeachingModeValue(selection)) return selection;
  return null;
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

/** האם סוג ההוראה של תלמידה מתאים לסינון (מלא / מקוצר / שניהם) */
export function studentTeachingTypeMatches(
  mode: TeachingMode,
  studentType: TeachingTrackType | null | undefined,
): boolean {
  if (mode === "full") return studentType === "full";
  if (mode === "short") return studentType === "short";
  if (mode === "both") return studentType === "full" || studentType === "short";
  return false;
}
