import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyColumnMap,
  assertRequiredHeaders,
  filterDataRows,
  sheetRowsToObjects,
  type ColumnMap,
  validateImportRows,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";
import { STUDENT_EXCEL_HEADERS } from "@/lib/students/excelTemplate";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "חסר קובץ או שהקובץ ריק" }, { status: 400 });
  }

  const name = file instanceof File ? file.name.toLowerCase() : "";
  if (name && !/\.(xlsx|xlsm|xls)$/.test(name)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך — העלי קובץ Excel (.xlsx או .xls)" }, { status: 400 });
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
  let columnMap: ColumnMap = {};
  if (typeof mapRaw === "string" && mapRaw.trim()) {
    try {
      columnMap = JSON.parse(mapRaw) as ColumnMap;
      raw = applyColumnMap(raw, columnMap);
    } catch {
      return NextResponse.json({ error: "מיפוי עמודות לא תקין" }, { status: 400 });
    }
  }

  const headers = Object.keys(raw[0] ?? {});
  const headerErr = assertRequiredHeaders(headers);
  if (headerErr) {
    return NextResponse.json({
      error: headerErr,
      headers,
      needMapping: true,
      requiredHeaders: [...STUDENT_EXCEL_HEADERS],
    }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  const [cl, sp, tr, tzRes] = await Promise.all([
    supabase.from("classes").select("id,name"),
    supabase.from("specializations").select("id,name"),
    supabase.from("tracks").select("id,name"),
    supabase.from("students").select("tz").eq("academic_year_id", scope.year.id),
  ]);

  for (const res of [cl, sp, tr, tzRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const existingTz = new Set((tzRes.data ?? []).map((r) => r.tz.trim()));

  const parsed = sheetRowsToObjects(raw);
  const validated = validateImportRows(parsed, {
    classByName,
    specByName,
    trackByName,
    academicYearId: scope.year.id,
  });

  const rows: (ValidatedImportRow & { warnings?: string[] })[] = validated.map((row) => {
    const warnings: string[] = [];
    if (row.tz && existingTz.has(row.tz) && row.errors.length === 0) {
      warnings.push("תלמידה עם ת״ז זו כבר קיימת במערכת (יידלג או יעודכן לפי הסימון בעת האישור)");
    }
    return { ...row, warnings };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const duplicateTz = rows.filter(
    (r) => r.errors.length === 0 && r.tz && existingTz.has(r.tz.trim()),
  ).length;
  const newCount = rows.filter(
    (r) => r.errors.length === 0 && r.tz && !existingTz.has(r.tz.trim()),
  ).length;

  return NextResponse.json({
    rows,
    validCount,
    errorCount,
    summary: { newCount, updateCount: duplicateTz, duplicateTz, errorCount, validCount },
    headers,
    columnMap,
  });
}
