import { filterDataRows } from "@/lib/students/excelImport";
import { parseGradeLevelsFromName } from "@/lib/gradeLevels/options";
import type { GradeLevel } from "@/lib/academicYears/types";
import type { LookupEntitySlug } from "@/lib/lookups/entities";
import { LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";

export type LookupColumnMap = { name?: string };

export type ParsedLookupRow = {
  rowNumber?: number;
  name: string;
};

export type ValidatedLookupRow = ParsedLookupRow & {
  rowNumber: number;
  errors: string[];
  warnings: string[];
  resolved?: {
    name: string;
    grade_levels?: GradeLevel[];
  };
};

export const LOOKUP_NAME_ALIASES = [
  LOOKUP_EXCEL_HEADER,
  "name",
  "Name",
  "שם כיתה",
  "שם התמחות",
  "שם מסלול",
  "שם שכבה",
  "כיתה",
  "התמחות",
  "מסלול",
  "שכבה",
] as const;

function cellStr(v: unknown): string {
  return String(v ?? "").trim();
}

export function normalizeLookupName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function lookupImportKey(name: string): string {
  return normalizeLookupName(name);
}

function findHeader(headers: string[], aliases: readonly string[]): string | null {
  const norm = (s: string) => s.trim().toLowerCase();
  for (const h of headers) {
    if (aliases.some((a) => norm(h) === norm(a))) return h;
  }
  for (const h of headers) {
    if (aliases.some((a) => norm(h).includes(norm(a)) || norm(a).includes(norm(h)))) return h;
  }
  return null;
}

export function assertLookupRequiredHeaders(headers: string[]): string | null {
  if (!headers.length) return "אין עמודות בקובץ";
  if (findHeader(headers, LOOKUP_NAME_ALIASES)) return null;
  return `חסרה עמודת «${LOOKUP_EXCEL_HEADER}» — ניתן למפות ידנית`;
}

export function applyLookupColumnMap(
  raw: Record<string, unknown>[],
  map: LookupColumnMap,
): Record<string, unknown>[] {
  if (!map.name) return raw;
  return raw.map((row) => {
    const out = { ...row };
    out[LOOKUP_EXCEL_HEADER] = row[map.name!] ?? "";
    return out;
  });
}

export function sheetRowsToLookupObjects(raw: Record<string, unknown>[]): ParsedLookupRow[] {
  const headers = Object.keys(raw[0] ?? {});
  const nameCol = findHeader(headers, LOOKUP_NAME_ALIASES) ?? LOOKUP_EXCEL_HEADER;
  return raw.map((row, i) => ({
    rowNumber: i + 2,
    name: cellStr(row[nameCol]),
  }));
}

export function validateLookupImportRows(
  rows: ParsedLookupRow[],
  entity: LookupEntitySlug,
  existingNames: Set<string>,
): ValidatedLookupRow[] {
  const seenInFile = new Set<string>();

  return rows.map((row, i) => {
    const rowNumber = row.rowNumber ?? i + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = normalizeLookupName(row.name);

    if (!name) {
      errors.push("שם חסר");
      return { ...row, rowNumber, name, errors, warnings };
    }

    const key = lookupImportKey(name);
    if (seenInFile.has(key)) {
      errors.push("שם כפול בקובץ");
    } else {
      seenInFile.add(key);
    }

    if (existingNames.has(key)) {
      warnings.push("כבר קיים במערכת — יידלג בייבוא");
    }

    if (entity === "grade-level-options") {
      const grade_levels = parseGradeLevelsFromName(name);
      if (!grade_levels.length) {
        errors.push("שם שכבה לא תקין — למשל: א, ב, ג או א+ב");
        return { ...row, rowNumber, name, errors, warnings };
      }
      return { ...row, rowNumber, name, errors, warnings, resolved: { name, grade_levels } };
    }

    return { ...row, rowNumber, name, errors, warnings, resolved: { name } };
  });
}

export { filterDataRows };
