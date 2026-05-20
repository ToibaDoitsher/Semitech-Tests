import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import {
  applyLookupColumnMap,
  assertLookupRequiredHeaders,
  filterDataRows,
  lookupImportKey,
  sheetRowsToLookupObjects,
  validateLookupImportRows,
  type LookupColumnMap,
} from "@/lib/lookups/excelImport";
import { LOOKUP_EXCEL_HEADER } from "@/lib/lookups/excelTemplate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "חסר קובץ או שהקובץ ריק" }, { status: 400 });
  }

  const fileName = file instanceof File ? file.name.toLowerCase() : "";
  if (fileName && !/\.(xlsx|xlsm|xls)$/.test(fileName)) {
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
  let columnMap: LookupColumnMap = {};
  if (typeof mapRaw === "string" && mapRaw.trim()) {
    try {
      columnMap = JSON.parse(mapRaw) as LookupColumnMap;
      raw = applyLookupColumnMap(raw, columnMap);
    } catch {
      return NextResponse.json({ error: "מיפוי עמודות לא תקין" }, { status: 400 });
    }
  }

  const headers = Object.keys(raw[0] ?? {});
  const headerErr = assertLookupRequiredHeaders(headers);
  if (headerErr) {
    return NextResponse.json(
      {
        error: headerErr,
        headers,
        needMapping: true,
        requiredHeaders: [LOOKUP_EXCEL_HEADER],
      },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const table = ENTITY_TO_TABLE[entity];
  let q = supabase.from(table).select("name");
  if (isYearScopedLookup(entity)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    q = q.eq("academic_year_id", scope.year.id).is("deleted_at", null);
  } else if (table !== "grade_level_options") {
    q = q.is("deleted_at", null);
  }

  const { data: existingRows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const existingNames = new Set(
    (existingRows ?? []).map((r) => lookupImportKey(String((r as { name: string }).name ?? ""))),
  );

  const parsed = sheetRowsToLookupObjects(raw);
  const rows = validateLookupImportRows(parsed, entity, existingNames);

  let newCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
  let validCount = 0;

  for (const row of rows) {
    if (row.errors.length) {
      errorCount += 1;
      continue;
    }
    validCount += 1;
    const key = row.resolved ? lookupImportKey(row.resolved.name) : "";
    if (key && existingNames.has(key)) duplicateCount += 1;
    else newCount += 1;
  }

  return NextResponse.json({
    rows,
    validCount,
    errorCount,
    summary: { newCount, duplicateCount, errorCount, validCount },
  });
}
