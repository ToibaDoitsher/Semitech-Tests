import { NextResponse } from "next/server";
import {
  assignmentImportKey,
  buildTeacherLookupMaps,
  validateAssignmentImportRows,
  type ParsedAssignmentRow,
  type ValidatedAssignmentRow,
} from "@/lib/assignments/excelImport";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { notDeleted } from "@/lib/db/softDelete";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { GradeLevel } from "@/lib/types/db";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedAssignmentRow[];
  skipDuplicates?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const skipDuplicates = body.skipDuplicates !== false;

  if (!rowsIn.length) return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

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
        grade_level: a.grade_level as GradeLevel,
        target_type: a.target_type,
        target_id: a.target_id,
        teaching_mode: (a.teaching_mode as "full" | "short" | null) ?? null,
      }),
    ),
  );

  const validated = validateAssignmentImportRows(rowsIn, {
    teacherMaps,
    classByName,
    specByName,
    trackByName,
    academicYearId: scope.year.id,
    trackNameById,
  });

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

  for (const r of good as ValidatedAssignmentRow[]) {
    if (!r.resolved) continue;
    const key = assignmentImportKey(scope.year.id, r.resolved);
    if (existingKeys.has(key)) {
      if (skipDuplicates) {
        skippedDuplicates += 1;
        continue;
      }
      rowErrors.push({ rowNumber: r.rowNumber, errors: ["שיבוץ זהה כבר קיים"] });
      continue;
    }
    existingKeys.add(key);
    toInsert.push({
      academic_year_id: scope.year.id,
      teacher_id: r.resolved.teacher_id,
      subject: r.resolved.subject,
      lesson_name: r.resolved.lesson_name,
      year_group: r.resolved.year_group,
      grade_level: r.resolved.grade_level,
      target_type: r.resolved.target_type,
      target_id: r.resolved.target_id,
      teaching_mode: r.resolved.teaching_mode,
    });
  }

  const chunk = 80;
  let inserted = 0;

  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("teacher_assignments").insert(slice);
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
