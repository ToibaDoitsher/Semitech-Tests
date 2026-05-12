export type LookupMaps = {
  gradeByName: Map<string, string>;
  classByName: Map<string, string>;
  specByName: Map<string, string>;
  trackByName: Map<string, string>;
};

export type ParsedImportRow = {
  rowNumber?: number;
  first_name: string;
  last_name: string;
  tz: string;
  grade_level: string;
  class_name: string;
  specialization: string;
  track: string;
};

export type ValidatedImportRow = ParsedImportRow & {
  rowNumber: number;
  errors: string[];
  resolved?: {
    grade_level_id: string;
    class_id: string;
    specialization_id: string | null;
    track_id: string | null;
  };
};

/** כותרות מקובלות: עברית (מומלץ) או אנגלית (תאימות לאחור) */
export const FIELD_ALIASES: Record<keyof Omit<ParsedImportRow, "rowNumber">, readonly string[]> = {
  first_name: ["שם פרטי", "first_name"],
  last_name: ["שם משפחה", "last_name"],
  tz: ["תעודת זהות", "ת״ז", "tz"],
  grade_level: ["שכבה", "grade_level"],
  class_name: ["כיתה", "class_name"],
  specialization: ["התמחות", "specialization"],
  track: ["מסלול", "track"],
} as const;

const FIELD_LABELS_HE: Record<keyof Omit<ParsedImportRow, "rowNumber">, string> = {
  first_name: "שם פרטי",
  last_name: "שם משפחה",
  tz: "תעודת זהות",
  grade_level: "שכבה",
  class_name: "כיתה",
  specialization: "התמחות",
  track: "מסלול",
};

const REQUIRED_FIELDS: (keyof typeof FIELD_ALIASES)[] = [
  "first_name",
  "last_name",
  "tz",
  "grade_level",
  "class_name",
  "specialization",
  "track",
];

function normalizeHeaderKey(k: string): string {
  const t = k.trim().replace(/\s+/g, " ");
  if (/^[a-z0-9_]+$/i.test(t)) return t.toLowerCase();
  return t;
}

export function assertRequiredHeaders(rawKeys: string[]): string | null {
  const nk = new Set(rawKeys.map((k) => normalizeHeaderKey(k)));
  for (const field of REQUIRED_FIELDS) {
    const ok = FIELD_ALIASES[field].some((a) => nk.has(normalizeHeaderKey(a)));
    if (!ok) return `חסרה עמודת חובה: ${FIELD_LABELS_HE[field]}`;
  }
  return null;
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
      rowNumber: i + 2,
      first_name: cellFromRow(obj, "first_name"),
      last_name: cellFromRow(obj, "last_name"),
      tz: cellFromRow(obj, "tz"),
      grade_level: cellFromRow(obj, "grade_level"),
      class_name: cellFromRow(obj, "class_name"),
      specialization: cellFromRow(obj, "specialization"),
      track: cellFromRow(obj, "track"),
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
    if (!r.grade_level) errors.push("שכבה חסרה");
    if (!r.class_name) errors.push("כיתה חסרה");
    if (!r.specialization) errors.push("התמחות חסרה");
    if (!r.track) errors.push("מסלול חסר");

    if (r.tz) {
      if (seenTz.has(r.tz)) errors.push(`תעודת זהות ${r.tz} מופיעה יותר מפעם אחת בקובץ`);
      seenTz.add(r.tz);
    }

    const g = lookupName(maps.gradeByName, r.grade_level, "השכבה");
    if (g.err) errors.push(g.err);

    const c = lookupName(maps.classByName, r.class_name, "הכיתה");
    if (c.err) errors.push(c.err);

    const s = lookupName(maps.specByName, r.specialization, "ההתמחות");
    if (s.err) errors.push(s.err);

    const t = lookupName(maps.trackByName, r.track, "המסלול");
    if (t.err) errors.push(t.err);

    const resolved =
      errors.length === 0 && g.id && c.id
        ? {
            grade_level_id: g.id,
            class_id: c.id,
            specialization_id: s.id ?? null,
            track_id: t.id ?? null,
          }
        : undefined;

    return { ...r, rowNumber, errors, resolved };
  });
}
