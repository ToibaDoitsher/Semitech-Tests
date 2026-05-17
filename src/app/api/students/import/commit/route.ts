import { NextResponse } from "next/server";
import { setAcademicYearCookie } from "@/lib/academic/year";
import { resolveImportTarget } from "@/lib/students/importTarget";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  validateImportRows,
  type ParsedImportRow,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedImportRow[];
  updateExisting?: boolean;
  cohort_number?: string | number;
  academic_year_name?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const updateExisting = Boolean(body.updateExisting);
  const cohortInput = String(body.cohort_number ?? "").trim();
  const academicYearName = (body.academic_year_name ?? "").trim();

  if (!rowsIn.length) return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });
  if (!cohortInput || !academicYearName) {
    return NextResponse.json({ error: "חובה מחזור ושנת לימודים" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const target = await resolveImportTarget(supabase, academicYearName, cohortInput);
  if (target.error) return NextResponse.json({ error: target.error }, { status: 400 });

  await setAcademicYearCookie(target.yearId);

  const [cl, sp, tr] = await Promise.all([
    supabase.from("classes").select("id,name"),
    supabase.from("specializations").select("id,name"),
    supabase.from("tracks").select("id,name"),
  ]);

  for (const res of [cl, sp, tr]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const validated = validateImportRows(rowsIn, { classByName, specByName, trackByName });

  const failed: { rowNumber: number; errors: string[] }[] = [];
  const good = validated.filter((r) => {
    if (r.errors.length) {
      failed.push({ rowNumber: r.rowNumber, errors: r.errors });
      return false;
    }
    return true;
  });

  const { data: existingRows, error: exErr } = await supabase.from("students").select("id,tz");
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const tzToId = new Map((existingRows ?? []).map((r) => [r.tz.trim(), r.id] as const));

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

  for (const r of good as ValidatedImportRow[]) {
    if (!r.resolved) continue;
    const patch = {
      first_name: r.first_name,
      last_name: r.last_name,
      tz: r.tz,
      class_id: r.resolved.class_id,
      specialization_id: r.resolved.specialization_id,
      track_id: r.resolved.track_id,
      cohort_number: target.cohortNumber,
      grade_level: target.grade,
      academic_year_id: target.yearId,
      status: "active",
    };
    const id = tzToId.get(r.tz.trim());
    if (id) {
      if (updateExisting) toUpdate.push({ id, patch });
    } else {
      toInsert.push(patch);
    }
  }

  const chunk = 80;
  let inserted = 0;
  let updated = 0;
  const rowErrors: { rowNumber: number; errors: string[] }[] = [...failed];

  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("students").insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
    for (const u of toUpdate) {
      const { error } = await supabase.from("students").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
      updated += 1;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: (e as Error).message,
        imported: inserted,
        updated,
        failed: rowErrors.length,
        errors: rowErrors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    imported: inserted,
    updated,
    failed: rowErrors.length,
    skipped: rowsIn.length - good.length - inserted - updated,
    errors: rowErrors,
    academic_year_id: target.yearId,
    cohort_number: target.cohortNumber,
    grade: target.grade,
  });
}
