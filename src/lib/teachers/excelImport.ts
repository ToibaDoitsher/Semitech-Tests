import { filterDataRows } from "@/lib/students/excelImport";
import { teacherDisplayName } from "@/lib/teachers/display";
import {
  normalizeTeacherEmail,
  normalizeTeacherTz,
  validateTeacherEmail,
  validateTeacherTz,
} from "@/lib/teachers/validation";

export { filterDataRows };

export type TeacherColumnMap = Partial<
  Record<keyof typeof TEACHER_FIELD_ALIASES, string>
>;

export type ParsedTeacherRow = {
  rowNumber?: number;
  first_name: string;
  last_name: string;
  tz: string;
  email: string;
  notes: string;
};

export type ValidatedTeacherRow = ParsedTeacherRow & {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  resolved?: {
    first_name: string;
    last_name: string;
    tz: string | null;
    email: string | null;
    notes: string | null;
  };
};

export const TEACHER_FIELD_ALIASES: Record<
  keyof Omit<ParsedTeacherRow, "rowNumber">,
  readonly string[]
> = {
  first_name: ["שם פרטי", "שם פרטי מורה", "first_name"],
  last_name: ["שם משפחה", "שם משפחה מורה", "last_name"],
  tz: ["תעודת זהות", "ת״ז", "tz"],
  email: ["מייל", "אימייל", "email"],
  notes: ["הערות", "notes"],
};

const NAME_FIELDS: (keyof typeof TEACHER_FIELD_ALIASES)[] = [
  "first_name",
  "last_name",
];

const ALL_FIELDS: (keyof typeof TEACHER_FIELD_ALIASES)[] = [
  ...NAME_FIELDS,
  "tz",
  "email",
  "notes",
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

function cellFromRow(obj: Record<string, unknown>, field: keyof typeof TEACHER_FIELD_ALIASES): string {
  const nkMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    nkMap.set(normalizeHeaderKey(k), v);
  }
  for (const alias of TEACHER_FIELD_ALIASES[field]) {
    const hit = nkMap.get(normalizeHeaderKey(alias));
    if (hit !== undefined) return normCell(hit);
  }
  return "";
}

export function assertTeacherRequiredHeaders(rawKeys: string[]): string | null {
  const nk = new Set(rawKeys.map((k) => normalizeHeaderKey(k)).filter(Boolean));
  const hasAnyName = NAME_FIELDS.some((field) =>
    TEACHER_FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a))),
  );
  if (hasAnyName) return null;
  const labels = NAME_FIELDS.map((field) => TEACHER_FIELD_ALIASES[field][0]).join(" / ");
  return `חסרה עמודת שם. נדרשת לפחות אחת מהעמודות: ${labels}. הורידי את התבנית ממסך ייבוא המורות.`;
}

export function sheetRowsToTeacherObjects(raw: Record<string, unknown>[]): ParsedTeacherRow[] {
  const out: ParsedTeacherRow[] = [];
  let i = 0;
  for (const obj of raw) {
    i += 1;
    out.push({
      rowNumber: i + 1,
      first_name: cellFromRow(obj, "first_name"),
      last_name: cellFromRow(obj, "last_name"),
      tz: cellFromRow(obj, "tz"),
      email: cellFromRow(obj, "email"),
      notes: cellFromRow(obj, "notes"),
    });
  }
  return out;
}

export function applyTeacherColumnMap(
  raw: Record<string, unknown>[],
  map: TeacherColumnMap,
): Record<string, unknown>[] {
  if (!Object.keys(map).length) return raw;
  return raw.map((row) => {
    const out: Record<string, unknown> = { ...row };
    for (const field of ALL_FIELDS) {
      const src = map[field]?.trim();
      if (!src) continue;
      const val =
        row[src] ??
        row[Object.keys(row).find((k) => normalizeHeaderKey(k) === normalizeHeaderKey(src)) ?? ""];
      if (val !== undefined) {
        out[TEACHER_FIELD_ALIASES[field][0]] = val;
      }
    }
    return out;
  });
}

function normalizeNameKey(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function teacherImportKey(row: {
  first_name: string;
  last_name: string;
  tz: string | null;
}): string {
  if (row.tz) return `tz:${row.tz}`;
  return `name:${normalizeNameKey(`${row.first_name} ${row.last_name}`)}`;
}

export type ExistingTeacherMaps = {
  byTz: Map<string, string>;
  byName: Map<string, string>;
};

export function buildExistingTeacherMaps(
  teachers: {
    id: string;
    first_name: string;
    last_name: string;
    tz: string | null;
  }[],
): ExistingTeacherMaps {
  const byTz = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const t of teachers) {
    const tz = (t.tz ?? "").trim();
    if (tz) byTz.set(tz, t.id);
    const nameKey = normalizeNameKey(`${t.first_name} ${t.last_name}`);
    if (nameKey) byName.set(nameKey, t.id);
    const displayKey = normalizeNameKey(teacherDisplayName(t));
    if (displayKey) byName.set(displayKey, t.id);
  }
  return { byTz, byName };
}

export function validateTeacherImportRows(
  rows: ParsedTeacherRow[],
  existing: ExistingTeacherMaps,
): ValidatedTeacherRow[] {
  const seenKeys = new Set<string>();
  const seenTz = new Set<string>();

  return rows.map((r, idx) => {
    const rowNumber = r.rowNumber ?? idx + 1;
    const errors: string[] = [];
    const warnings: string[] = [];

    const first_name = r.first_name.trim();
    const last_name = r.last_name.trim();

    if (!first_name && !last_name) {
      errors.push("חובה להזין לפחות אחד מהשמות (שם פרטי או שם משפחה)");
    }

    const tzErr = validateTeacherTz(r.tz);
    if (tzErr) errors.push(tzErr);

    const emailErr = validateTeacherEmail(r.email);
    if (emailErr) errors.push(emailErr);

    const tz = normalizeTeacherTz(r.tz);
    const email = normalizeTeacherEmail(r.email);
    const notes = r.notes.trim() || null;

    if (tz) {
      if (seenTz.has(tz)) errors.push(`ת״ז ${tz} מופיעה יותר מפעם אחת בקובץ`);
      else seenTz.add(tz);
    }

    const key = teacherImportKey({ first_name, last_name, tz });
    if (seenKeys.has(key)) {
      errors.push("שורה כפולה בקובץ (אותו שם או ת״ז)");
    } else {
      seenKeys.add(key);
    }

    if (!errors.length) {
      if (tz && existing.byTz.has(tz)) {
        warnings.push("מורה עם ת״ז זו כבר קיימת — תידלג בייבוא");
      } else {
        const nameKey = normalizeNameKey(`${first_name} ${last_name}`);
        if (existing.byName.has(nameKey)) {
          warnings.push("מורה בשם זה כבר קיימת — תידלג בייבוא");
        }
      }
    }

    const resolved =
      errors.length === 0
        ? { first_name, last_name, tz, email, notes }
        : undefined;

    return { ...r, rowNumber, errors, warnings, resolved };
  });
}
