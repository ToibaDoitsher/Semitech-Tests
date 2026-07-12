import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTargetsFingerprint } from "@/lib/assignments/multiTarget";
import {
  sheetRowsToAssignmentObjects,
  validateAssignmentImportRows,
  assignmentImportKey,
  type ValidatedAssignmentRow,
} from "@/lib/assignments/excelImport";
import {
  formatAssignmentImportInsertError,
  loadAssignmentImportContext,
} from "@/lib/assignments/importContext";
import { rowToMultiTarget } from "@/lib/assignments/multiTarget";
import { notDeleted } from "@/lib/db/softDelete";
import { ENTITY_TO_TABLE } from "@/lib/lookups/entities";
import {
  filterDataRows,
  lookupImportKey,
  sheetRowsToLookupObjects,
  validateLookupImportRows,
  type ValidatedLookupRow,
} from "@/lib/lookups/excelImport";
import {
  sheetRowsToObjects,
  validateImportRows,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";
import { assertUniqueStudentTz } from "@/lib/validations/students";
import {
  buildExistingTeacherMaps,
  sheetRowsToTeacherObjects,
  teacherImportKey,
  validateTeacherImportRows,
  type ValidatedTeacherRow,
} from "@/lib/teachers/excelImport";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";
import { readFirstSheetRows } from "@/lib/yearPack/excelIo";
import {
  YEAR_PACK_PARTS,
  type YearPackPartKey,
  matchYearPackPart,
} from "@/lib/yearPack/manifest";

export type YearPackFileInput = { name: string; buffer: Buffer };

export type PartImportStats = {
  key: YearPackPartKey;
  label: string;
  inserted: number;
  updated: number;
  failed: number;
  errors: { rowNumber: number; errors: string[] }[];
};

export type YearPackImportResult = {
  ok: boolean;
  parts: PartImportStats[];
  error?: string;
};

function emptyStats(key: YearPackPartKey, label: string): PartImportStats {
  return { key, label, inserted: 0, updated: 0, failed: 0, errors: [] };
}

function resolveFiles(files: YearPackFileInput[]): Map<YearPackPartKey, Buffer> {
  const map = new Map<YearPackPartKey, Buffer>();
  for (const f of files) {
    const key = matchYearPackPart(f.name);
    if (key) map.set(key, f.buffer);
  }
  return map;
}

async function importLookups(
  supabase: SupabaseClient,
  yearId: string,
  entity: "classes" | "specializations" | "tracks",
  buf: Buffer,
): Promise<PartImportStats> {
  const label = YEAR_PACK_PARTS.find((p) => p.key === entity)!.label;
  const stats = emptyStats(entity, label);
  const raw = filterDataRows(readFirstSheetRows(buf));
  if (!raw.length) return stats;

  const table = ENTITY_TO_TABLE[entity];
  const { data: existingRows, error: loadErr } = await supabase
    .from(table)
    .select("id,name,is_active,deleted_at")
    .eq("academic_year_id", yearId);
  if (loadErr) throw new Error(loadErr.message);

  const byKey = new Map<
    string,
    { id: string; is_active: boolean; deleted_at: string | null }
  >();
  for (const r of existingRows ?? []) {
    const row = r as { id: string; name: string; is_active: boolean; deleted_at: string | null };
    byKey.set(lookupImportKey(row.name), {
      id: row.id,
      is_active: row.is_active,
      deleted_at: row.deleted_at,
    });
  }

  const existingNames = new Set(byKey.keys());
  const validated = validateLookupImportRows(sheetRowsToLookupObjects(raw), entity, existingNames);
  const chunkInsert: Record<string, unknown>[] = [];

  for (const r of validated as ValidatedLookupRow[]) {
    if (r.errors.length) {
      stats.failed += 1;
      stats.errors.push({ rowNumber: r.rowNumber, errors: r.errors });
      continue;
    }
    if (!r.resolved) continue;
    const key = lookupImportKey(r.resolved.name);
    const existing = byKey.get(key);
    if (existing) {
      const needs =
        !existing.is_active || existing.deleted_at != null;
      if (needs) {
        const { error } = await supabase
          .from(table)
          .update({ is_active: true, deleted_at: null })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        stats.updated += 1;
      } else {
        stats.updated += 1; // כבר קיים — נספר כעודכן (ללא שינוי תוכן)
      }
      continue;
    }
    byKey.set(key, { id: "", is_active: true, deleted_at: null });
    chunkInsert.push({
      name: r.resolved.name,
      is_active: true,
      academic_year_id: yearId,
    });
  }

  for (let i = 0; i < chunkInsert.length; i += 80) {
    const slice = chunkInsert.slice(i, i + 80);
    const { error } = await supabase.from(table).insert(slice);
    if (error) throw new Error(error.message);
    stats.inserted += slice.length;
  }
  return stats;
}

async function importTeachers(
  supabase: SupabaseClient,
  yearId: string,
  buf: Buffer,
): Promise<PartImportStats> {
  const stats = emptyStats("teachers", "מורות");
  const raw = filterDataRows(readFirstSheetRows(buf));
  if (!raw.length) return stats;

  const { data: teachers, error: loadErr } = await notDeleted(
    supabase.from("teachers").select(TEACHER_COLUMNS).eq("academic_year_id", yearId),
  );
  if (loadErr) throw new Error(loadErr.message);

  const existing = buildExistingTeacherMaps(teachers ?? []);
  const idByKey = new Map<string, string>();
  for (const t of teachers ?? []) {
    idByKey.set(
      teacherImportKey({
        first_name: t.first_name,
        last_name: t.last_name,
        tz: (t.tz as string | null) ?? null,
      }),
      t.id,
    );
  }

  const validated = validateTeacherImportRows(sheetRowsToTeacherObjects(raw), existing);
  const toInsert: Record<string, unknown>[] = [];

  for (const r of validated as ValidatedTeacherRow[]) {
    if (r.errors.length) {
      stats.failed += 1;
      stats.errors.push({ rowNumber: r.rowNumber, errors: r.errors });
      continue;
    }
    if (!r.resolved) continue;
    const key = teacherImportKey(r.resolved);
    const id = idByKey.get(key);
    const patch = {
      academic_year_id: yearId,
      first_name: r.resolved.first_name,
      last_name: r.resolved.last_name,
      tz: r.resolved.tz,
      email: r.resolved.email,
      notes: r.resolved.notes,
    };
    if (id) {
      const { error } = await supabase.from("teachers").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      stats.updated += 1;
    } else {
      idByKey.set(key, "");
      toInsert.push(patch);
    }
  }

  for (let i = 0; i < toInsert.length; i += 80) {
    const slice = toInsert.slice(i, i + 80);
    const { error } = await supabase.from("teachers").insert(slice);
    if (error) throw new Error(error.message);
    stats.inserted += slice.length;
  }
  return stats;
}

async function importStudents(
  supabase: SupabaseClient,
  yearId: string,
  buf: Buffer,
): Promise<PartImportStats> {
  const stats = emptyStats("students", "תלמידות");
  const raw = filterDataRows(readFirstSheetRows(buf));
  if (!raw.length) return stats;

  const [cl, sp, tr] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name")
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("specializations")
      .select("id,name")
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("tracks")
      .select("id,name")
      .eq("academic_year_id", yearId)
      .eq("is_active", true)
      .is("deleted_at", null),
  ]);
  for (const res of [cl, sp, tr]) {
    if (res.error) throw new Error(res.error.message);
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));

  const validated = validateImportRows(sheetRowsToObjects(raw), {
    classByName,
    specByName,
    trackByName,
    academicYearId: yearId,
  });

  const { data: existingRows, error: exErr } = await notDeleted(
    supabase.from("students").select("id,tz"),
  ).eq("academic_year_id", yearId);
  if (exErr) throw new Error(exErr.message);
  const tzToId = new Map((existingRows ?? []).map((r) => [r.tz.trim(), r.id] as const));

  const importBatchId = crypto.randomUUID();
  const toInsert: Record<string, unknown>[] = [];

  for (const r of validated as ValidatedImportRow[]) {
    if (r.errors.length) {
      stats.failed += 1;
      stats.errors.push({ rowNumber: r.rowNumber, errors: r.errors });
      continue;
    }
    if (!r.resolved) continue;
    const patch = {
      academic_year_id: yearId,
      first_name: r.first_name,
      last_name: r.last_name,
      tz: r.tz,
      class_id: r.resolved.class_id,
      specialization_id: r.resolved.specialization_id,
      secondary_specialization_id: r.resolved.secondary_specialization_id,
      track_id: r.resolved.track_id,
      is_psychology: r.resolved.is_psychology,
      teaching_track_type: r.resolved.teaching_track_type,
      grade_level: r.resolved.grade_level,
      status: "active" as const,
    };
    const id = tzToId.get(r.tz.trim());
    if (id) {
      const { error } = await supabase.from("students").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      stats.updated += 1;
    } else {
      const tzOk = await assertUniqueStudentTz(supabase, r.tz, yearId);
      if (!tzOk.ok) {
        stats.failed += 1;
        stats.errors.push({ rowNumber: r.rowNumber, errors: [tzOk.error ?? "ת״ז כפולה"] });
        continue;
      }
      toInsert.push({ ...patch, import_batch_id: importBatchId });
    }
  }

  for (let i = 0; i < toInsert.length; i += 80) {
    const slice = toInsert.slice(i, i + 80);
    const { error } = await supabase.from("students").insert(slice);
    if (error) throw new Error(error.message);
    stats.inserted += slice.length;
  }
  return stats;
}

async function importAssignments(
  supabase: SupabaseClient,
  yearId: string,
  buf: Buffer,
): Promise<PartImportStats> {
  const stats = emptyStats("assignments", "שיבוצים");
  const raw = filterDataRows(readFirstSheetRows(buf));
  if (!raw.length) return stats;

  const loaded = await loadAssignmentImportContext(supabase, yearId);
  if ("error" in loaded) throw new Error(loaded.error);
  const { ctx } = loaded;

  // מפתחות קיימים → id לעדכון
  const { data: existingRows, error: exErr } = await notDeleted(
    supabase.from("teacher_assignments").select(
      "id,teacher_id,grade_levels,subject,lesson_name,assignment_category,class_ids,track_ids,specialization_ids,psychology_enabled,applies_to_all_in_grade,teaching_mode",
    ),
  ).eq("academic_year_id", yearId);
  if (exErr) throw new Error(exErr.message);

  const idByKey = new Map<string, string>();
  for (const a of existingRows ?? []) {
    const key = assignmentImportKey(yearId, {
      teacher_id: a.teacher_id,
      subject: String(a.subject).trim(),
      lesson_name: (a.lesson_name as string | null) ?? null,
      teaching_mode: (a.teaching_mode as TeachingTrackType | null) ?? null,
      assignment_category: a.assignment_category as AssignmentCategory,
      ...rowToMultiTarget(a as Parameters<typeof rowToMultiTarget>[0]),
    });
    idByKey.set(key, a.id as string);
  }

  const validated = validateAssignmentImportRows(sheetRowsToAssignmentObjects(raw), ctx);
  const toInsert: Record<string, unknown>[] = [];

  for (const r of validated as ValidatedAssignmentRow[]) {
    if (r.errors.length) {
      stats.failed += 1;
      stats.errors.push({ rowNumber: r.rowNumber, errors: r.errors });
      continue;
    }
    if (!r.resolved) continue;
    const key = assignmentImportKey(yearId, r.resolved);
    const fingerprint = computeTargetsFingerprint(r.resolved);
    const patch = {
      academic_year_id: yearId,
      teacher_id: r.resolved.teacher_id,
      subject: r.resolved.subject,
      lesson_name: r.resolved.lesson_name,
      grade_levels: r.resolved.grade_levels,
      assignment_category: r.resolved.assignment_category,
      class_ids: r.resolved.class_ids,
      track_ids: r.resolved.track_ids,
      specialization_ids: r.resolved.specialization_ids,
      psychology_enabled: r.resolved.psychology_enabled,
      applies_to_all_in_grade: r.resolved.applies_to_all_in_grade,
      targets_fingerprint: fingerprint,
      teaching_mode: r.resolved.teaching_mode,
    };
    const id = idByKey.get(key);
    if (id) {
      const { error } = await supabase.from("teacher_assignments").update(patch).eq("id", id);
      if (error) throw new Error(formatAssignmentImportInsertError(error.message));
      stats.updated += 1;
    } else {
      idByKey.set(key, "");
      ctx.existingKeys.add(key);
      toInsert.push(patch);
    }
  }

  for (let i = 0; i < toInsert.length; i += 80) {
    const slice = toInsert.slice(i, i + 80);
    const { error } = await supabase.from("teacher_assignments").insert(slice);
    if (error) throw new Error(formatAssignmentImportInsertError(error.message));
    stats.inserted += slice.length;
  }
  return stats;
}

/** ייבוא חבילת שנה: לוקאפים → מורות → תלמידות → שיבוצים. לא מוחק קיים. */
export async function importYearPack(
  supabase: SupabaseClient,
  yearId: string,
  files: YearPackFileInput[],
): Promise<YearPackImportResult> {
  const byKey = resolveFiles(files);
  if (!byKey.size) {
    return {
      ok: false,
      parts: [],
      error:
        "לא נמצאו קבצי אקסל מתאימים בתיקייה. צפויים: כיתות, התמחויות, מסלולים, מורות, תלמידות, שיבוצים",
    };
  }

  const parts: PartImportStats[] = [];

  try {
    for (const entity of ["classes", "specializations", "tracks"] as const) {
      const buf = byKey.get(entity);
      if (buf) parts.push(await importLookups(supabase, yearId, entity, buf));
      else parts.push({ ...emptyStats(entity, YEAR_PACK_PARTS.find((p) => p.key === entity)!.label) });
    }

    const teachersBuf = byKey.get("teachers");
    parts.push(
      teachersBuf
        ? await importTeachers(supabase, yearId, teachersBuf)
        : emptyStats("teachers", "מורות"),
    );

    const studentsBuf = byKey.get("students");
    parts.push(
      studentsBuf
        ? await importStudents(supabase, yearId, studentsBuf)
        : emptyStats("students", "תלמידות"),
    );

    const assignmentsBuf = byKey.get("assignments");
    parts.push(
      assignmentsBuf
        ? await importAssignments(supabase, yearId, assignmentsBuf)
        : emptyStats("assignments", "שיבוצים"),
    );

    return { ok: true, parts };
  } catch (e) {
    return {
      ok: false,
      parts,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
