import { NextResponse } from "next/server";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import * as XLSX from "xlsx";
import {
  applyTeacherColumnMap,
  assertTeacherRequiredHeaders,
  buildExistingTeacherMaps,
  sheetRowsToTeacherObjects,
  teacherImportKey,
  TEACHER_FIELD_ALIASES,
  validateTeacherImportRows,
  type TeacherColumnMap,
} from "@/lib/teachers/excelImport";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { filterDataRows } from "@/lib/students/excelImport";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_HEADER_LABELS = [
  `${TEACHER_FIELD_ALIASES.first_name[0]} או ${TEACHER_FIELD_ALIASES.last_name[0]} (לפחות אחד)`,
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
  let columnMap: TeacherColumnMap = {};
  if (typeof mapRaw === "string" && mapRaw.trim()) {
    try {
      columnMap = JSON.parse(mapRaw) as TeacherColumnMap;
      raw = applyTeacherColumnMap(raw, columnMap);
    } catch {
      return NextResponse.json({ error: "מיפוי עמודות לא תקין" }, { status: 400 });
    }
  }

  const headers = Object.keys(raw[0] ?? {});
  const headerErr = assertTeacherRequiredHeaders(headers);
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
  const { data: teachers, error } = await notDeleted(
    supabase.from("teachers").select(TEACHER_COLUMNS).eq("academic_year_id", scope.year.id),
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const existing = buildExistingTeacherMaps(teachers ?? []);
  const existingKeys = new Set(
    (teachers ?? []).map((t) =>
      teacherImportKey({
        first_name: t.first_name,
        last_name: t.last_name,
        tz: (t.tz as string | null) ?? null,
      }),
    ),
  );

  const parsed = sheetRowsToTeacherObjects(raw);
  const validated = validateTeacherImportRows(parsed, existing);

  const rows = validated.map((row) => {
    const warnings = [...row.warnings];
    if (row.resolved) {
      const key = teacherImportKey(row.resolved);
      if (existingKeys.has(key) && !warnings.length) {
        warnings.push("כבר קיימת במערכת — תידלג בייבוא");
      }
    }
    return { ...row, warnings };
  });

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
    const key = row.resolved ? teacherImportKey(row.resolved) : "";
    if (key && existingKeys.has(key)) duplicateCount += 1;
    else newCount += 1;
  }

  return NextResponse.json({
    rows,
    validCount,
    errorCount,
    summary: { newCount, duplicateCount, errorCount, validCount },
  });
}
