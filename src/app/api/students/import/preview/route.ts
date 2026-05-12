import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertRequiredHeaders,
  sheetRowsToObjects,
  validateImportRows,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
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
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!raw.length) return NextResponse.json({ error: "אין שורות נתונים" }, { status: 400 });

  const headerErr = assertRequiredHeaders(Object.keys(raw[0] ?? {}));
  if (headerErr) return NextResponse.json({ error: headerErr }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [gl, cl, sp, tr, tzRes] = await Promise.all([
    supabase.from("grade_levels").select("id,name"),
    supabase.from("classes").select("id,name"),
    supabase.from("specializations").select("id,name"),
    supabase.from("tracks").select("id,name"),
    supabase.from("students").select("tz"),
  ]);

  for (const res of [gl, cl, sp, tr, tzRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const gradeByName = new Map((gl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const existingTz = new Set((tzRes.data ?? []).map((r) => r.tz.trim()));

  const parsed = sheetRowsToObjects(raw);
  const validated = validateImportRows(parsed, { gradeByName, classByName, specByName, trackByName });

  const rows: (ValidatedImportRow & { warnings?: string[] })[] = validated.map((row) => {
    const warnings: string[] = [];
    if (row.tz && existingTz.has(row.tz) && row.errors.length === 0) {
      warnings.push("תלמידה עם ת״ז זו כבר קיימת במערכת (יידלג או יעודכן לפי הסימון בעת האישור)");
    }
    return { ...row, warnings };
  });

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  return NextResponse.json({ rows, validCount, errorCount });
}
