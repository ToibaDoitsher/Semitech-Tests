import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  applyAssignmentColumnMap,
  assertAssignmentRequiredHeaders,
  ASSIGNMENT_FIELD_ALIASES,
  assignmentImportKey,
  buildTeacherLookupMaps,
  sheetRowsToAssignmentObjects,
  validateAssignmentImportRows,
  type AssignmentColumnMap,
  type ValidatedAssignmentRow,
} from "@/lib/assignments/excelImport";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { filterDataRows } from "@/lib/students/excelImport";
import {
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUIRED_HEADER_LABELS = [
  ASSIGNMENT_FIELD_ALIASES.teacher_first_name[0],
  ASSIGNMENT_FIELD_ALIASES.teacher_last_name[0],
  ASSIGNMENT_FIELD_ALIASES.subject[0],
  ASSIGNMENT_FIELD_ALIASES.year_group[0],
  ASSIGNMENT_FIELD_ALIASES.grade_level[0],
  ASSIGNMENT_FIELD_ALIASES.target_type_raw[0],
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

  const [cl, sp, tr, teachersRes, existingRes] = await Promise.all([
    supabase.from("classes").select("id,name").eq("is_active", true),
    supabase.from("specializations").select("id,name").eq("is_active", true),
    supabase.from("tracks").select("id,name").eq("is_active", true),
    notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS)),
    notDeleted(supabase.from("teacher_assignments").select(
      "teacher_id,year_group,grade_level,subject,lesson_name,target_type,target_id,teaching_mode",
    )).eq("academic_year_id", scope.year.id),
  ]);

  for (const res of [cl, sp, tr, teachersRes, existingRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackNameById = new Map((tr.data ?? []).map((r) => [r.id, r.name.trim()] as const));
  const teacherMaps = buildTeacherLookupMaps(teachersRes.data ?? []);

  const existingKeys = new Set(
    (existingRes.data ?? []).map((a) =>
      assignmentImportKey(scope.year.id, {
        teacher_id: a.teacher_id,
        subject: a.subject.trim(),
        lesson_name: (a.lesson_name as string | null) ?? null,
        year_group: a.year_group,
        grade_level: a.grade_level as "א" | "ב" | "ג",
        target_type: a.target_type,
        target_id: a.target_id,
        teaching_mode: (a.teaching_mode as "full" | "short" | null) ?? null,
      }),
    ),
  );

  const parsed = sheetRowsToAssignmentObjects(raw);
  const validated = validateAssignmentImportRows(parsed, {
    teacherMaps,
    classByName,
    specByName,
    trackByName,
    academicYearId: scope.year.id,
    trackNameById,
  });

  const rows: (ValidatedAssignmentRow & { warnings?: string[] })[] = validated.map((row) => {
    const warnings: string[] = [];
    if (row.resolved) {
      const key = assignmentImportKey(scope.year.id, row.resolved);
      if (existingKeys.has(key)) {
        warnings.push("שיבוץ זהה כבר קיים — השורה תידלג בייבוא");
      }
    }
    return { ...row, warnings };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = rows.filter(
    (r) => r.errors.length === 0 && r.resolved && existingKeys.has(assignmentImportKey(scope.year.id, r.resolved)),
  ).length;
  const newCount = rows.filter(
    (r) =>
      r.errors.length === 0 &&
      r.resolved &&
      !existingKeys.has(assignmentImportKey(scope.year.id, r.resolved)),
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
