import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  applyAssignmentColumnMap,
  assertAssignmentRequiredHeaders,
  ASSIGNMENT_FIELD_ALIASES,
  assignmentImportKey,
  sheetRowsToAssignmentObjects,
  validateAssignmentImportRows,
  type AssignmentColumnMap,
  type ValidatedAssignmentRow,
} from "@/lib/assignments/excelImport";
import { loadAssignmentImportContext } from "@/lib/assignments/importContext";
import { filterDataRows } from "@/lib/students/excelImport";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_HEADER_LABELS = [
  `${ASSIGNMENT_FIELD_ALIASES.teacher_first_name[0]} / ${ASSIGNMENT_FIELD_ALIASES.teacher_last_name[0]} (לפחות אחד)`,
  "מקצוע או שם שיעור",
  ASSIGNMENT_FIELD_ALIASES.grade_level[0],
  ASSIGNMENT_FIELD_ALIASES.assignment_category_raw[0],
];

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "חסר קובץ או שהקובץ ריק" }, { status: 400 });
  }

  const name = file instanceof File ? file.name.toLowerCase() : "";
  if (name && !/\.(xlsx|xlsm|xls)$/.test(name)) {
    return NextResponse.json(
      { error: "סוג קובץ לא נתמך — העלי קובץ Excel (.xlsx או .xls)" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ error: "לא ניתן לקרוא את קובץ האקסל" }, { status: 400 });
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "גיליון ריק" }, { status: 400 });

  const sheet = wb.Sheets[sheetName];
  const rawAll = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  let raw = filterDataRows(rawAll);
  if (!raw.length) return NextResponse.json({ error: "אין שורות נתונים בגיליון" }, { status: 400 });

  const mapRaw = form.get("column_map");
  let columnMap: AssignmentColumnMap = {};
  if (typeof mapRaw === "string" && mapRaw.trim()) {
    try {
      columnMap = JSON.parse(mapRaw) as AssignmentColumnMap;
      raw = applyAssignmentColumnMap(raw, columnMap);
    } catch {
      return NextResponse.json({ error: "מיפוי עמודות לא תקין" }, { status: 400 });
    }
  }

  const headers = Object.keys(raw[0] ?? {});
  const headerErr = assertAssignmentRequiredHeaders(headers);
  if (headerErr) {
    return NextResponse.json(
      {
        error: headerErr,
        headers,
        needMapping: true,
        requiredHeaders: REQUIRED_HEADER_LABELS,
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );

  const loaded = await loadAssignmentImportContext(supabase, scope.year.id);
  if ("error" in loaded) {
    return NextResponse.json({ error: dbSchemaHint(loaded.error) }, { status: 500 });
  }
  const { ctx } = loaded;

  const parsed = sheetRowsToAssignmentObjects(raw);
  const validated = validateAssignmentImportRows(parsed, ctx);

  const seenInBatch = new Set<string>();
  const rows: ValidatedAssignmentRow[] = validated.map((row) => {
    const warnings = [...row.warnings];
    if (row.resolved) {
      const key = assignmentImportKey(ctx.academicYearId, row.resolved);
      if (ctx.existingKeys.has(key)) {
        warnings.push("שיבוץ זהה כבר קיים — השורה תידלג בייבוא");
      } else if (seenInBatch.has(key)) {
        warnings.push("שיבוץ זהה מופיע פעמיים בקובץ — השורה תידלג בייבוא");
      } else {
        seenInBatch.add(key);
      }
    }
    return { ...row, warnings };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = rows.filter(
    (r) =>
      r.errors.length === 0 &&
      r.resolved &&
      ctx.existingKeys.has(assignmentImportKey(ctx.academicYearId, r.resolved)),
  ).length;
  const newCount = rows.filter(
    (r) =>
      r.errors.length === 0 &&
      r.resolved &&
      !ctx.existingKeys.has(assignmentImportKey(ctx.academicYearId, r.resolved)),
  ).length;

  return NextResponse.json({
    rows,
    validCount,
    errorCount,
    summary: { newCount, duplicateCount, errorCount, validCount },
    headers,
    columnMap,
  });
}
