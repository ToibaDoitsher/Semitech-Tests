import { NextResponse } from "next/server";
import { resolveAcademicYearScope, readOnlyResponse, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { isYearScopedLookup } from "@/lib/lookups/yearScope";
import {
  lookupImportKey,
  validateLookupImportRows,
  type ParsedLookupRow,
  type ValidatedLookupRow,
} from "@/lib/lookups/excelImport";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedLookupRow[];
  skipDuplicates?: boolean;
};

export async function POST(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const skipDuplicates = body.skipDuplicates !== false;

  if (!rowsIn.length) return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const table = ENTITY_TO_TABLE[entity];
  let academicYearId: string | null = null;

  if (isYearScopedLookup(entity)) {
    const scope = await resolveAcademicYearScope(
      supabase,
      scopeFromSearchParams(new URL(request.url).searchParams),
    );
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }
    academicYearId = scope.year.id;
  }

  let q = supabase.from(table).select("name");
  if (isYearScopedLookup(entity) && academicYearId) {
    q = q.eq("academic_year_id", academicYearId).is("deleted_at", null);
  }

  const { data: existingRows, error: loadErr } = await q;
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });

  const existingNames = new Set(
    (existingRows ?? []).map((r) => lookupImportKey(String((r as { name: string }).name ?? ""))),
  );

  const validated = validateLookupImportRows(rowsIn, entity, existingNames);

  const failed: { rowNumber: number; errors: string[] }[] = [];
  const good = validated.filter((r) => {
    if (r.errors.length) {
      failed.push({ rowNumber: r.rowNumber, errors: r.errors });
      return false;
    }
    return true;
  });

  const toInsert: Record<string, unknown>[] = [];
  const rowErrors: { rowNumber: number; errors: string[] }[] = [...failed];
  let skippedDuplicates = 0;

  for (const r of good as ValidatedLookupRow[]) {
    if (!r.resolved) continue;
    const key = lookupImportKey(r.resolved.name);
    if (existingNames.has(key)) {
      if (skipDuplicates) {
        skippedDuplicates += 1;
        continue;
      }
      rowErrors.push({ rowNumber: r.rowNumber, errors: ["ערך זה כבר קיים במערכת"] });
      continue;
    }
    existingNames.add(key);

    const row: Record<string, unknown> = {
      name: r.resolved.name,
      is_active: true,
    };
    if (isYearScopedLookup(entity) && academicYearId) {
      row.academic_year_id = academicYearId;
    }
    if (entity === "grade-level-options" && r.resolved.grade_levels) {
      row.grade_levels = r.resolved.grade_levels;
    }
    toInsert.push(row);
  }

  const chunk = 80;
  let inserted = 0;

  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from(table).insert(slice);
      if (error) throw new Error(error.message);
      inserted += slice.length;
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: (e as Error).message,
        imported: inserted,
        failed: rowErrors.length,
        skippedDuplicates,
        errors: rowErrors,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    imported: inserted,
    skippedDuplicates,
    failed: rowErrors.length,
    errors: rowErrors,
  });
}
