import {
  isTeachingTrackName,
  parsePsychologyCell,
  parseTeachingTrackTypeCell,
  type TeachingTrackType,
} from "@/lib/students/fields";
import { STUDENT_EXCEL_HEADERS } from "@/lib/students/excelTemplate";
import { parseGradeLevel, parseYearGroup } from "@/lib/academicYears/labels";
import type { GradeLevel } from "@/lib/academicYears/types";

export type LookupMaps = {
  classByName: Map<string, string>;
  specByName: Map<string, string>;
  trackByName: Map<string, string>;
  academicYearId: string;
};

export type ParsedImportRow = {
  rowNumber?: number;
  first_name: string;
  last_name: string;
  tz: string;
  class_name: string;
  specialization: string;
  track: string;
  secondary_specialization?: string;
  psychology?: string;
  teaching_track_type?: string;
  year_group: string;
  grade_level: string;
};

export type ValidatedImportRow = ParsedImportRow & {
  rowNumber: number;
  errors: string[];
  resolved?: {
    academic_year_id: string;
    class_id: string;
    specialization_id: string | null;
    secondary_specialization_id: string | null;
    track_id: string | null;
    year_group: number;
    grade_level: GradeLevel;
    is_psychology: boolean;
    teaching_track_type: TeachingTrackType | null;
  };
};

export const FIELD_ALIASES: Record<keyof Omit<ParsedImportRow, "rowNumber">, readonly string[]> = {
  first_name: ["שם פרטי", "first_name"],
  last_name: ["שם משפחה", "last_name"],
  tz: ["תעודת זהות", "ת״ז", "tz"],
  class_name: ["כיתה", "class_name"],
  specialization: ["התמחות", "specialization"],
  track: ["מסלול", "track"],
  secondary_specialization: ["התמחות נוספת", "התמחות נוס", "secondary_specialization"],
  psychology: ["פסיכולוגיה", "psychology"],
  teaching_track_type: ["הוראה מקוצר", "סוג הוראה", "teaching_track_type"],
  year_group: ["שנתון", "year_group", "year"],
  grade_level: ["שכבה", "grade_level", "grade"],
} as const;

const REQUIRED_FIELDS: (keyof typeof FIELD_ALIASES)[] = [
  "first_name",
  "last_name",
  "tz",
  "class_name",
  "specialization",
  "track",
  "year_group",
  "grade_level",
];

const ALL_IMPORT_FIELDS: (keyof typeof FIELD_ALIASES)[] = [
  ...REQUIRED_FIELDS,
  "secondary_specialization",
  "psychology",
  "teaching_track_type",
];

function normalizeHeaderKey(k: string): string {
  const t = k.trim().replace(/\s+/g, " ");
  if (/^[a-z0-9_]+$/i.test(t)) return t.toLowerCase();
  return t;
}

export type ColumnMap = Partial<Record<keyof Omit<ParsedImportRow, "rowNumber">, string>>;

function findCell(row: Record<string, unknown>, header: string): unknown {
  if (header in row) return row[header];
  const nk = normalizeHeaderKey(header);
  for (const [k, v] of Object.entries(row)) {
    if (normalizeHeaderKey(k) === nk) return v;
  }
  return undefined;
}

export function applyColumnMap(
  raw: Record<string, unknown>[],
  map: ColumnMap,
): Record<string, unknown>[] {
  if (!Object.keys(map).length) return raw;
  return raw.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const field of ALL_IMPORT_FIELDS) {
      const src = map[field]?.trim();
      if (!src) continue;
      const val = findCell(row, src);
      if (val !== undefined) {
        const canonical = FIELD_ALIASES[field][0];
        out[canonical] = val;
      }
    }
    return out;
  });
}

export function assertRequiredHeaders(rawKeys: string[]): string | null {
  const nk = new Set(rawKeys.map((k) => normalizeHeaderKey(k)).filter(Boolean));
  const missing: string[] = [];
  for (const header of STUDENT_EXCEL_HEADERS) {
    const field = Object.entries(FIELD_ALIASES).find(([, aliases]) =>
      aliases.some((a) => normalizeHeaderKey(a) === normalizeHeaderKey(header)),
    )?.[0] as keyof typeof FIELD_ALIASES | undefined;
    if (!field) continue;
    const ok = FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a)));
    if (!ok) missing.push(header);
  }
  if (!missing.length) return null;
  return `חסרות עמודות בקובץ: ${missing.join(", ")}. הורידי את התבנית הרשמית מ«תבנית» במסך ייבוא.`;
}

export function filterDataRows(raw: Record<string, unknown>[]): Record<string, unknown>[] {
  return raw.filter((row) => {
    const vals = Object.values(row).map((v) => normCell(v));
    return vals.some((v) => v.length > 0);
  });
}

function normCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function cellFromRow(obj: Record<string, unknown>, field: keyof typeof FIELD_ALIASES): string {
  const nkMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    nkMap.set(normalizeHeaderKey(k), v);
  }
  for (const alias of FIELD_ALIASES[field]) {
    const hit = nkMap.get(normalizeHeaderKey(alias));
    if (hit !== undefined) return normCell(hit);
  }
  return "";
}

export function sheetRowsToObjects(raw: Record<string, unknown>[]): ParsedImportRow[] {
  const out: ParsedImportRow[] = [];
  let i = 0;
  for (const obj of raw) {
    i += 1;
    out.push({
      rowNumber: i + 1,
      first_name: cellFromRow(obj, "first_name"),
      last_name: cellFromRow(obj, "last_name"),
      tz: cellFromRow(obj, "tz"),
      class_name: cellFromRow(obj, "class_name"),
      specialization: cellFromRow(obj, "specialization"),
      track: cellFromRow(obj, "track"),
      secondary_specialization: cellFromRow(obj, "secondary_specialization"),
      psychology: cellFromRow(obj, "psychology"),
      teaching_track_type: cellFromRow(obj, "teaching_track_type"),
      year_group: cellFromRow(obj, "year_group"),
      grade_level: cellFromRow(obj, "grade_level"),
    });
  }
  return out;
}

function lookupName(map: Map<string, string>, name: string, label: string): { id?: string; err?: string } {
  const id = map.get(name);
  if (!id) return { err: `${label} "${name}" לא קיים במערכת` };
  return { id };
}

export function validateImportRows(rows: ParsedImportRow[], maps: LookupMaps): ValidatedImportRow[] {
  const seenTz = new Set<string>();
  return rows.map((r, idx) => {
    const rowNumber = r.rowNumber ?? idx + 1;
    const errors: string[] = [];

    if (!r.first_name) errors.push("שם פרטי חסר");
    if (!r.last_name) errors.push("שם משפחה חסר");
    if (!r.tz) errors.push("תעודת זהות חסרה");
    if (!r.class_name) errors.push("כיתה חסרה");
    if (!r.specialization) errors.push("התמחות חסרה");
    if (!r.track) errors.push("מסלול חסר");
    if (!r.year_group?.trim()) errors.push("שנתון חסר");
    if (!r.grade_level?.trim()) errors.push("שכבה חסרה");

    if (r.tz) {
      if (seenTz.has(r.tz)) errors.push(`תעודת זהות ${r.tz} מופיעה יותר מפעם אחת בקובץ`);
      seenTz.add(r.tz);
    }

    const c = lookupName(maps.classByName, r.class_name, "הכיתה");
    if (c.err) errors.push(c.err);

    const s = lookupName(maps.specByName, r.specialization, "ההתמחות");
    if (s.err) errors.push(s.err);

    const t = lookupName(maps.trackByName, r.track, "המסלול");
    if (t.err) errors.push(t.err);

    const year_group = parseYearGroup(r.year_group ?? "");
    const grade_level = parseGradeLevel(r.grade_level ?? "");
    if (!year_group) errors.push("שנתון לא תקין");
    if (!grade_level) errors.push("שכבה לא תקינה (א/ב/ג)");

    let secondary_specialization_id: string | null = null;
    if (r.secondary_specialization?.trim()) {
      const s2 = lookupName(maps.specByName, r.secondary_specialization.trim(), "התמחות הנוספת");
      if (s2.err) errors.push(s2.err);
      else secondary_specialization_id = s2.id ?? null;
      if (s.id && secondary_specialization_id && s.id === secondary_specialization_id) {
        errors.push("התמחות נוספת חייבת להיות שונה מהראשית");
      }
    }

    const is_psychology = parsePsychologyCell(r.psychology ?? "");
    let teaching_track_type: TeachingTrackType | null = null;
    if (r.teaching_track_type?.trim()) {
      if (!isTeachingTrackName(r.track)) {
        errors.push("הוראה מקוצר/מלא מותר רק כשמסלול הוא «הוראה»");
      } else {
        teaching_track_type = parseTeachingTrackTypeCell(r.teaching_track_type);
        if (!teaching_track_type) {
          errors.push('עמודת «הוראה מקוצר»: השתמשי ב«מלא», «מקוצר», «כן» או «לא» (או ריק)');
        }
      }
    }

    const resolved =
      errors.length === 0 && c.id && year_group && grade_level
        ? {
            academic_year_id: maps.academicYearId,
            class_id: c.id,
            specialization_id: s.id ?? null,
            secondary_specialization_id,
            track_id: t.id ?? null,
            year_group,
            grade_level,
            is_psychology,
            teaching_track_type,
          }
        : undefined;

    return { ...r, rowNumber, errors, resolved };
  });
}
