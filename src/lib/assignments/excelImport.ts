import { parseGradeLevel } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";
import {
  assignmentImportKey,
  normalizeTargetInput,
  parseAssignmentCategory,
  validateAssignmentWithCategory,
  type AssignmentTargetColumns,
} from "@/lib/assignments/target";
import type { AssignmentCategory } from "@/lib/types/db";
import { ASSIGNMENT_EXCEL_HEADERS } from "@/lib/assignments/excelTemplate";
import {
  isTeachingTrackName,
  parsePsychologyCell,
  parseTeachingTrackTypeCell,
} from "@/lib/students/fields";
import { teacherDisplayName } from "@/lib/teachers/display";
import type { TeachingMode } from "@/lib/types/db";
import { filterDataRows } from "@/lib/students/excelImport";

export { filterDataRows };
export { assignmentImportKey };

export type AssignmentColumnMap = Partial<
  Record<keyof typeof ASSIGNMENT_FIELD_ALIASES, string>
>;

export type ParsedAssignmentRow = {
  rowNumber?: number;
  teacher_first_name: string;
  teacher_last_name: string;
  subject: string;
  lesson_name: string;
  grade_level: string;
  assignment_category_raw: string;
  class_name: string;
  specialization_name: string;
  track_name: string;
  psychology_raw: string;
  teaching_mode_raw: string;
};

export type ValidatedAssignmentRow = ParsedAssignmentRow & {
  rowNumber: number;
  errors: string[];
  resolved?: {
    teacher_id: string;
    subject: string;
    lesson_name: string | null;
    grade_level: GradeLevel;
    assignment_category: AssignmentCategory;
    teaching_mode: TeachingMode | null;
  } & AssignmentTargetColumns;
};

export const ASSIGNMENT_FIELD_ALIASES: Record<
  keyof Omit<ParsedAssignmentRow, "rowNumber">,
  readonly string[]
> = {
  teacher_first_name: ["שם פרטי מורה", "שם פרטי", "first_name"],
  teacher_last_name: ["שם משפחה מורה", "שם משפחה", "last_name"],
  subject: ["מקצוע", "subject"],
  lesson_name: ["שם שיעור", "שיעור", "lesson_name"],
  grade_level: ["שכבה", "grade_level", "grade"],
  assignment_category_raw: ["סוג שיבוץ", "assignment_category", "category"],
  class_name: ["כיתה", "class", "class_name"],
  specialization_name: ["התמחות", "specialization", "specialization_name"],
  track_name: ["מסלול", "track", "track_name"],
  psychology_raw: ["פסיכולוגיה", "psychology", "psychology_enabled"],
  teaching_mode_raw: ["סוג הוראה", "הוראה מקוצר", "teaching_mode"],
};

const REQUIRED_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
  "teacher_first_name",
  "teacher_last_name",
  "grade_level",
  "assignment_category_raw",
];

const ALL_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
  ...REQUIRED_FIELDS,
  "lesson_name",
  "class_name",
  "specialization_name",
  "track_name",
  "psychology_raw",
  "teaching_mode_raw",
];

function normalizeHeaderKey(k: string): string {
  const t = k.trim().replace(/\s+/g, " ");
  if (/^[a-z0-9_]+$/i.test(t)) return t.toLowerCase();
  return t;
}

function normCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    if (Number.isInteger(v) && Math.abs(v) < 1e10) return String(Math.trunc(v));
    return String(v).trim();
  }
  return String(v).trim();
}

function cellFromRow(obj: Record<string, unknown>, field: keyof typeof ASSIGNMENT_FIELD_ALIASES): string {
  const nkMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    nkMap.set(normalizeHeaderKey(k), v);
  }
  for (const alias of ASSIGNMENT_FIELD_ALIASES[field]) {
    const hit = nkMap.get(normalizeHeaderKey(alias));
    if (hit !== undefined) return normCell(hit);
  }
  return "";
}

export function normalizeSubjectLessonFields(
  subject: string,
  lessonName: string,
): { subject: string; lesson_name: string | null; error?: string } {
  const s = subject.trim();
  const l = lessonName.trim();
  if (!s && !l) {
    return {
      subject: "",
      lesson_name: null,
      error: "מקצוע או שם שיעור — למלא לפחות אחד",
    };
  }
  if (s && l) return { subject: s, lesson_name: l };
  if (s) return { subject: s, lesson_name: null };
  return { subject: l, lesson_name: l };
}

export function assertAssignmentRequiredHeaders(rawKeys: string[]): string | null {
  const nk = new Set(rawKeys.map((k) => normalizeHeaderKey(k)).filter(Boolean));
  const missing: string[] = [];
  for (const field of REQUIRED_FIELDS) {
    const ok = ASSIGNMENT_FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a)));
    if (!ok) missing.push(ASSIGNMENT_FIELD_ALIASES[field][0]);
  }
  const hasSubjectOrLesson =
    ASSIGNMENT_FIELD_ALIASES.subject.some((a) => nk.has(normalizeHeaderKey(a))) ||
    ASSIGNMENT_FIELD_ALIASES.lesson_name.some((a) => nk.has(normalizeHeaderKey(a)));
  if (!hasSubjectOrLesson) missing.push("מקצוע או שם שיעור");
  if (!missing.length) return null;
  return `חסרות עמודות חובה: ${missing.join(", ")}. הורידי את התבנית ממסך ייבוא השיבוצים.`;
}

export function sheetRowsToAssignmentObjects(raw: Record<string, unknown>[]): ParsedAssignmentRow[] {
  const out: ParsedAssignmentRow[] = [];
  let i = 0;
  for (const obj of raw) {
    i += 1;
    out.push({
      rowNumber: i + 1,
      teacher_first_name: cellFromRow(obj, "teacher_first_name"),
      teacher_last_name: cellFromRow(obj, "teacher_last_name"),
      subject: cellFromRow(obj, "subject"),
      lesson_name: cellFromRow(obj, "lesson_name"),
      grade_level: cellFromRow(obj, "grade_level"),
      assignment_category_raw: cellFromRow(obj, "assignment_category_raw"),
      class_name: cellFromRow(obj, "class_name"),
      specialization_name: cellFromRow(obj, "specialization_name"),
      track_name: cellFromRow(obj, "track_name"),
      psychology_raw: cellFromRow(obj, "psychology_raw"),
      teaching_mode_raw: cellFromRow(obj, "teaching_mode_raw"),
    });
  }
  return out;
}

export function applyAssignmentColumnMap(
  raw: Record<string, unknown>[],
  map: AssignmentColumnMap,
): Record<string, unknown>[] {
  if (!Object.keys(map).length) return raw;
  return raw.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const field of ALL_FIELDS) {
      const src = map[field]?.trim();
      if (!src) continue;
      const val = row[src] ?? row[Object.keys(row).find((k) => normalizeHeaderKey(k) === normalizeHeaderKey(src)) ?? ""];
      if (val !== undefined) {
        out[ASSIGNMENT_FIELD_ALIASES[field][0]] = val;
      }
    }
    return out;
  });
}

function normalizeNameKey(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export type TeacherLookupMaps = {
  byFullName: Map<string, string>;
  byParts: Map<string, string>;
};

export function buildTeacherLookupMaps(
  teachers: { id: string; first_name: string; last_name: string; full_name_generated?: string | null }[],
): TeacherLookupMaps {
  const byFullName = new Map<string, string>();
  const byParts = new Map<string, string>();
  for (const t of teachers) {
    const full = normalizeNameKey(teacherDisplayName(t));
    if (full) byFullName.set(full, t.id);
    const parts = normalizeNameKey(`${t.first_name} ${t.last_name}`);
    if (parts) byParts.set(parts, t.id);
  }
  return { byFullName, byParts };
}

function resolveTeacherId(
  maps: TeacherLookupMaps,
  first: string,
  last: string,
): { id?: string; err?: string } {
  const parts = normalizeNameKey(`${first} ${last}`);
  if (!parts) return { err: "שם מורה חסר" };
  const byParts = maps.byParts.get(parts);
  if (byParts) return { id: byParts };
  const byFull = maps.byFullName.get(parts);
  if (byFull) return { id: byFull };
  return { err: `מורה "${first} ${last}" לא נמצאה — הוסיפי אותה במסך מורות` };
}

function targetFromRow(
  r: ParsedAssignmentRow,
  category: AssignmentCategory,
  classByName: Map<string, string>,
  specByName: Map<string, string>,
  trackByName: Map<string, string>,
): { target: AssignmentTargetColumns; errors: string[] } {
  const errors: string[] = [];
  const className = r.class_name.trim();
  const specName = r.specialization_name.trim();
  const trackName = r.track_name.trim();
  const psych = parsePsychologyCell(r.psychology_raw);

  let class_id: string | null = null;
  let specialization_id: string | null = null;
  let track_id: string | null = null;

  if (className) {
    class_id = classByName.get(className) ?? null;
    if (!class_id) errors.push(`כיתה "${className}" לא קיימת בלוקאפים`);
  }
  if (specName) {
    specialization_id = specByName.get(specName) ?? null;
    if (!specialization_id) errors.push(`התמחות "${specName}" לא קיימת בלוקאפים`);
  }
  if (trackName) {
    track_id = trackByName.get(trackName) ?? null;
    if (!track_id) errors.push(`מסלול "${trackName}" לא קיים בלוקאפים`);
  }

  const target = normalizeTargetInput({
    class_id,
    specialization_id,
    track_id,
    psychology_enabled: psych,
  });

  const targetErr = validateAssignmentWithCategory(category, target);
  if (targetErr) errors.push(targetErr);

  if (category === "חובה" && !className && !trackName && !psych && !errors.length) {
    errors.push("בשיבוץ חובה — מלאי כיתה, מסלול או פסיכולוגיה");
  }
  if (category === "התמחות" && !specName && !errors.length) {
    errors.push("בשיבוץ התמחות — מלאי התמחות");
  }

  return { target, errors };
}

export type AssignmentImportMaps = {
  teacherMaps: TeacherLookupMaps;
  classByName: Map<string, string>;
  specByName: Map<string, string>;
  trackByName: Map<string, string>;
  trackNameById: Map<string, string>;
};

export function validateAssignmentImportRows(
  rows: ParsedAssignmentRow[],
  maps: AssignmentImportMaps,
): ValidatedAssignmentRow[] {
  return rows.map((r, idx) => {
    const rowNumber = r.rowNumber ?? idx + 1;
    const errors: string[] = [];

    if (!r.teacher_first_name.trim()) errors.push("שם פרטי מורה חסר");
    if (!r.teacher_last_name.trim()) errors.push("שם משפחה מורה חסר");
    const subjectLesson = normalizeSubjectLessonFields(r.subject, r.lesson_name);
    if (subjectLesson.error) errors.push(subjectLesson.error);
    if (!r.grade_level.trim()) errors.push("שכבה חסרה");

    const category = parseAssignmentCategory(r.assignment_category_raw);
    if (!category) errors.push('סוג שיבוץ חסר או לא תקין (חובה / התמחות)');

    const teacher = resolveTeacherId(maps.teacherMaps, r.teacher_first_name, r.teacher_last_name);
    if (teacher.err) errors.push(teacher.err);

    const grade_level = parseGradeLevel(r.grade_level);
    if (!grade_level) errors.push("שכבה לא תקינה (א/ב/ג)");

    const { target, errors: targetErrors } = category
      ? targetFromRow(r, category, maps.classByName, maps.specByName, maps.trackByName)
      : { target: normalizeTargetInput({}), errors: [] as string[] };
    errors.push(...targetErrors);

    let teaching_mode: TeachingMode | null = null;
    if (r.teaching_mode_raw.trim()) {
      if (!target.track_id) {
        errors.push("סוג הוראה מותר רק כשמולא מסלול");
      } else {
        const trackName = maps.trackNameById.get(target.track_id) ?? "";
        if (!isTeachingTrackName(trackName)) {
          errors.push("סוג הוראה מותר רק במסלול «הוראה»");
        } else {
          teaching_mode = parseTeachingTrackTypeCell(r.teaching_mode_raw);
          if (!teaching_mode) errors.push("סוג הוראה לא תקין (מלא/מקוצר)");
        }
      }
    }

    const resolved =
      errors.length === 0 && teacher.id && grade_level && category && !subjectLesson.error
        ? {
            teacher_id: teacher.id,
            subject: subjectLesson.subject,
            lesson_name: subjectLesson.lesson_name,
            grade_level,
            assignment_category: category,
            ...target,
            teaching_mode,
          }
        : undefined;

    return { ...r, rowNumber, errors, resolved };
  });
}
