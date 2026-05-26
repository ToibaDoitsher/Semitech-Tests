import { parseGradeLevel } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";
import {
  assignmentImportKey,
  filterGradeLevels,
  normalizeMultiTargetInput,
  validateMultiTarget,
  type AssignmentMultiSpec,
  type AssignmentMultiTarget,
} from "@/lib/assignments/multiTarget";
import { parseAssignmentCategory } from "@/lib/assignments/target";
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
  warnings: string[];
  resolved?: AssignmentMultiSpec;
};

function splitTargetCell(raw: string): string[] {
  return raw
    .split(/[,+]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGradeLevelsCell(raw: string): GradeLevel[] {
  const out: GradeLevel[] = [];
  for (const part of splitTargetCell(raw)) {
    const g = parseGradeLevel(part);
    if (g && !out.includes(g)) out.push(g);
  }
  return out;
}

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

const TEACHER_NAME_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
  "teacher_first_name",
  "teacher_last_name",
];

const REQUIRED_FIELDS: (keyof typeof ASSIGNMENT_FIELD_ALIASES)[] = [
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
  const hasAnyTeacherName = TEACHER_NAME_FIELDS.some((field) =>
    ASSIGNMENT_FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a))),
  );
  if (!hasAnyTeacherName) {
    missing.push(
      `${ASSIGNMENT_FIELD_ALIASES.teacher_first_name[0]} / ${ASSIGNMENT_FIELD_ALIASES.teacher_last_name[0]} (לפחות אחד)`,
    );
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
  byFirst: Map<string, string[]>;
  byLast: Map<string, string[]>;
};

function addToNameBucket(map: Map<string, string[]>, key: string, id: string): void {
  if (!key) return;
  const list = map.get(key) ?? [];
  if (!list.includes(id)) list.push(id);
  map.set(key, list);
}

export function buildTeacherLookupMaps(
  teachers: { id: string; first_name: string; last_name: string; full_name_generated?: string | null }[],
): TeacherLookupMaps {
  const byFullName = new Map<string, string>();
  const byParts = new Map<string, string>();
  const byFirst = new Map<string, string[]>();
  const byLast = new Map<string, string[]>();
  for (const t of teachers) {
    const full = normalizeNameKey(teacherDisplayName(t));
    if (full) byFullName.set(full, t.id);
    const parts = normalizeNameKey(`${t.first_name} ${t.last_name}`);
    if (parts) byParts.set(parts, t.id);
    addToNameBucket(byFirst, normalizeNameKey(t.first_name), t.id);
    addToNameBucket(byLast, normalizeNameKey(t.last_name), t.id);
  }
  return { byFullName, byParts, byFirst, byLast };
}

function resolveTeacherId(
  maps: TeacherLookupMaps,
  first: string,
  last: string,
): { id?: string; err?: string } {
  const firstTrim = first.trim();
  const lastTrim = last.trim();
  if (!firstTrim && !lastTrim) {
    return { err: "חובה להזין שם פרטי או שם משפחה של מורה (לפחות אחד)" };
  }

  const combined = normalizeNameKey(`${firstTrim} ${lastTrim}`);
  if (combined) {
    const byParts = maps.byParts.get(combined);
    if (byParts) return { id: byParts };
    const byFull = maps.byFullName.get(combined);
    if (byFull) return { id: byFull };
  }

  if (firstTrim && !lastTrim) {
    const ids = maps.byFirst.get(normalizeNameKey(firstTrim)) ?? [];
    if (!ids.length) return { err: `מורה "${firstTrim}" לא נמצאה — הוסיפי אותה תחילה ברשימת המורות` };
    if (ids.length > 1) {
      return { err: `כמה מורות עם השם "${firstTrim}" — הוסיפי גם שם משפחה` };
    }
    return { id: ids[0] };
  }

  if (lastTrim && !firstTrim) {
    const ids = maps.byLast.get(normalizeNameKey(lastTrim)) ?? [];
    if (!ids.length) return { err: `מורה "${lastTrim}" לא נמצאה — הוסיפי אותה תחילה ברשימת המורות` };
    if (ids.length > 1) {
      return { err: `כמה מורות עם שם משפחה "${lastTrim}" — הוסיפי גם שם פרטי` };
    }
    return { id: ids[0] };
  }

  return {
    err: `מורה "${firstTrim} ${lastTrim}" לא נמצאה — הוסיפי אותה תחילה ברשימת המורות`,
  };
}

function targetFromRow(
  r: ParsedAssignmentRow,
  category: AssignmentCategory,
  gradeLevels: GradeLevel[],
  classByName: Map<string, string>,
  specByName: Map<string, string>,
  trackByName: Map<string, string>,
): { target: AssignmentMultiTarget; errors: string[] } {
  const errors: string[] = [];
  const psych = parsePsychologyCell(r.psychology_raw);

  const classNames = splitTargetCell(r.class_name);
  const applies_to_all_in_grade = classNames.some((n) => /כל\s*השכבה/i.test(n));
  const class_ids: string[] = [];
  if (!applies_to_all_in_grade) {
    for (const name of classNames) {
      if (/כל\s*השכבה/i.test(name)) continue;
      const id = classByName.get(name);
      if (!id) errors.push(`כיתה "${name}" לא קיימת בלוקאפים`);
      else if (!class_ids.includes(id)) class_ids.push(id);
    }
  }

  const specialization_ids: string[] = [];
  for (const name of splitTargetCell(r.specialization_name)) {
    const id = specByName.get(name);
    if (!id) errors.push(`התמחות "${name}" לא קיימת בלוקאפים`);
    else if (!specialization_ids.includes(id)) specialization_ids.push(id);
  }

  const track_ids: string[] = [];
  for (const name of splitTargetCell(r.track_name)) {
    const id = trackByName.get(name);
    if (!id) errors.push(`מסלול "${name}" לא קיים בלוקאפים`);
    else if (!track_ids.includes(id)) track_ids.push(id);
  }

  const target = normalizeMultiTargetInput({
    grade_levels: gradeLevels,
    class_ids,
    track_ids,
    specialization_ids,
    psychology_enabled: psych,
    applies_to_all_in_grade,
  });

  const targetErr = validateMultiTarget(category, target);
  if (targetErr) errors.push(targetErr);

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
    const warnings: string[] = [];

    if (!r.teacher_first_name.trim() && !r.teacher_last_name.trim()) {
      errors.push("חובה להזין שם פרטי או שם משפחה של מורה (לפחות אחד)");
    }
    const subjectLesson = normalizeSubjectLessonFields(r.subject, r.lesson_name);
    if (subjectLesson.error) errors.push(subjectLesson.error);
    if (!r.grade_level.trim()) errors.push("שכבה חסרה");

    const category = parseAssignmentCategory(r.assignment_category_raw);
    if (!category) errors.push('סוג שיבוץ חסר או לא תקין (חובה / התמחות)');

    const teacher = resolveTeacherId(maps.teacherMaps, r.teacher_first_name, r.teacher_last_name);
    if (teacher.err) errors.push(teacher.err);

    const grade_levels = parseGradeLevelsCell(r.grade_level);
    if (!grade_levels.length) errors.push("שכבה לא תקינה (א/ב/ג — אפשר כמה מופרדות בפסיק)");

    const { target, errors: targetErrors } = category
      ? targetFromRow(
          r,
          category,
          grade_levels,
          maps.classByName,
          maps.specByName,
          maps.trackByName,
        )
      : {
          target: normalizeMultiTargetInput({ grade_levels }),
          errors: [] as string[],
        };
    errors.push(...targetErrors);

    let teaching_mode: TeachingMode | null = null;
    if (r.teaching_mode_raw.trim()) {
      if (target.track_ids.length !== 1) {
        errors.push("סוג הוראה מותר רק כשמולא מסלול אחד");
      } else {
        const trackName = maps.trackNameById.get(target.track_ids[0]) ?? "";
        if (!isTeachingTrackName(trackName)) {
          errors.push("סוג הוראה מותר רק במסלול «הוראה»");
        } else {
          teaching_mode = parseTeachingTrackTypeCell(r.teaching_mode_raw);
          if (!teaching_mode) errors.push("סוג הוראה לא תקין (מלא/מקוצר)");
        }
      }
    }

    const resolved =
      errors.length === 0 && teacher.id && grade_levels.length && category && !subjectLesson.error
        ? {
            teacher_id: teacher.id,
            subject: subjectLesson.subject,
            lesson_name: subjectLesson.lesson_name,
            assignment_category: category,
            teaching_mode,
            ...target,
            grade_levels: filterGradeLevels(grade_levels),
          }
        : undefined;

    return { ...r, rowNumber, errors, warnings, resolved };
  });
}
