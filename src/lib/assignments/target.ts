import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import { isTeachingTrackName, type TeachingTrackType } from "@/lib/students/fields";
import type { AssignmentCategory, GradeLevel, TeachingMode } from "@/lib/types/db";

export type AssignmentTargetColumns = {
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
};

export type AssignmentTargetRow = AssignmentTargetColumns & {
  id: string;
  assignment_category?: AssignmentCategory;
};

export type AssignmentTargetInput = {
  class_id?: string | null;
  specialization_id?: string | null;
  track_id?: string | null;
  psychology_enabled?: boolean;
};

export function parseAssignmentCategory(raw: string): AssignmentCategory | null {
  const t = raw.trim();
  if (t === "חובה" || t === "mandatory") return "חובה";
  if (t === "התמחות" || t === "specialization") return "התמחות";
  return null;
}

export function normalizeTargetInput(raw: AssignmentTargetInput): AssignmentTargetColumns {
  const class_id = raw.class_id?.trim() || null;
  const specialization_id = raw.specialization_id?.trim() || null;
  const track_id = raw.track_id?.trim() || null;
  const psychology_enabled = Boolean(raw.psychology_enabled);
  return { class_id, specialization_id, track_id, psychology_enabled };
}

export function countMandatoryTargets(t: AssignmentTargetColumns): number {
  let n = 0;
  if (t.class_id) n += 1;
  if (t.track_id) n += 1;
  if (t.psychology_enabled) n += 1;
  return n;
}

/** @deprecated use validateAssignmentWithCategory */
export function validateAssignmentTarget(t: AssignmentTargetColumns): string | null {
  const n =
    (t.class_id ? 1 : 0) +
    (t.specialization_id ? 1 : 0) +
    (t.track_id ? 1 : 0) +
    (t.psychology_enabled ? 1 : 0);
  if (n === 0) return "חובה לבחור יעד";
  if (n > 1) return "ניתן לבחור רק יעד אחד";
  return null;
}

export function validateAssignmentWithCategory(
  category: AssignmentCategory,
  target: AssignmentTargetColumns,
): string | null {
  if (category === "התמחות") {
    if (!target.specialization_id) return "בחרי התמחות";
    if (target.class_id || target.track_id || target.psychology_enabled) {
      return "בשיבוץ התמחות — רק שדה התמחות";
    }
    return null;
  }

  if (target.specialization_id) return "בשיבוץ חובה — אין לבחור התמחות";
  const n = countMandatoryTargets(target);
  if (n === 0) return "בחרי כיתה, מסלול או פסיכולוגיה";
  if (n > 1) return "ניתן לבחור רק יעד אחד";
  if (target.psychology_enabled && (target.class_id || target.track_id)) {
    return "פסיכולוגיה לא יכולה להיות יחד עם יעד אחר";
  }
  return null;
}

export function assignmentTargetKind(
  t: AssignmentTargetColumns,
): "class" | "specialization" | "track" | "psychology" | null {
  if (t.psychology_enabled) return "psychology";
  if (t.class_id) return "class";
  if (t.specialization_id) return "specialization";
  if (t.track_id) return "track";
  return null;
}

export function assignmentTargetTypeLabel(
  t: AssignmentTargetColumns,
  category?: AssignmentCategory,
): string {
  if (category === "התמחות") return "התמחות";
  if (category === "חובה") {
    const k = assignmentTargetKind(t);
    if (k === "class") return "חובה · כיתה";
    if (k === "track") return "חובה · מסלול";
    if (k === "psychology") return "חובה · פסיכולוגיה";
    return "חובה";
  }
  const k = assignmentTargetKind(t);
  if (k === "class") return "כיתה";
  if (k === "specialization") return "התמחות";
  if (k === "track") return "מסלול";
  if (k === "psychology") return "פסיכולוגיה";
  return "—";
}

export async function resolveAssignmentTargetLabels(
  supabase: SupabaseClient,
  rows: AssignmentTargetRow[],
): Promise<Record<string, string>> {
  const classIds = new Set<string>();
  const specIds = new Set<string>();
  const trackIds = new Set<string>();

  for (const r of rows) {
    if (r.class_id) classIds.add(r.class_id);
    if (r.specialization_id) specIds.add(r.specialization_id);
    if (r.track_id) trackIds.add(r.track_id);
  }

  const names = new Map<string, string>();
  if (classIds.size) {
    const { data } = await supabase.from("classes").select("id,name").in("id", [...classIds]);
    for (const x of data ?? []) names.set(`class:${(x as { id: string }).id}`, (x as { name: string }).name);
  }
  if (specIds.size) {
    const { data } = await supabase.from("specializations").select("id,name").in("id", [...specIds]);
    for (const x of data ?? [])
      names.set(`spec:${(x as { id: string }).id}`, (x as { name: string }).name);
  }
  if (trackIds.size) {
    const { data } = await supabase.from("tracks").select("id,name").in("id", [...trackIds]);
    for (const x of data ?? []) names.set(`track:${(x as { id: string }).id}`, (x as { name: string }).name);
  }

  const labels: Record<string, string> = {};
  for (const r of rows) {
    if (r.psychology_enabled) {
      labels[r.id] = "פסיכולוגיה";
      continue;
    }
    if (r.class_id) labels[r.id] = names.get(`class:${r.class_id}`) ?? r.class_id;
    else if (r.specialization_id) labels[r.id] = names.get(`spec:${r.specialization_id}`) ?? r.specialization_id;
    else if (r.track_id) labels[r.id] = names.get(`track:${r.track_id}`) ?? r.track_id;
    else labels[r.id] = "—";
  }
  return labels;
}

export type YearGradeScope = {
  academic_year_id: string;
  year_group: number;
  grade_level: GradeLevel;
};

export async function fetchStudentIdsForAssignmentTarget(
  supabase: SupabaseClient,
  target: AssignmentTargetColumns,
  scope: YearGradeScope,
  options?: { teachingTrackType?: TeachingTrackType | null; category?: AssignmentCategory },
): Promise<{ ids: string[]; error: string | null }> {
  const category = options?.category;
  const err = category
    ? validateAssignmentWithCategory(category, target)
    : validateAssignmentTarget(target);
  if (err) return { ids: [], error: err };

  if (target.psychology_enabled) {
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", scope.academic_year_id)
      .eq("year_group", scope.year_group)
      .eq("grade_level", scope.grade_level)
      .eq("is_psychology", true);
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  if (target.specialization_id || category === "התמחות") {
    if (!target.specialization_id) return { ids: [], error: "התמחות חסרה" };
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", scope.academic_year_id)
      .eq("year_group", scope.year_group)
      .eq("grade_level", scope.grade_level)
      .or(
        `specialization_id.eq.${target.specialization_id},secondary_specialization_id.eq.${target.specialization_id}`,
      );
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  if (target.track_id) {
    const { data: trackRow } = await supabase
      .from("tracks")
      .select("name")
      .eq("id", target.track_id)
      .maybeSingle();
    let q = notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", scope.academic_year_id)
      .eq("year_group", scope.year_group)
      .eq("grade_level", scope.grade_level)
      .eq("track_id", target.track_id);
    if (isTeachingTrackName((trackRow?.name as string) ?? "") && options?.teachingTrackType) {
      q = q.eq("teaching_track_type", options.teachingTrackType);
    }
    const { data, error } = await q;
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  if (target.class_id) {
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", scope.academic_year_id)
      .eq("year_group", scope.year_group)
      .eq("grade_level", scope.grade_level)
      .eq("class_id", target.class_id);
    if (error) return { ids: [], error: error.message };
    return { ids: (data ?? []).map((r) => r.id as string), error: null };
  }

  return { ids: [], error: "יעד שיבוץ לא תקין" };
}

export function assignmentTargetMatches(
  a: AssignmentTargetColumns,
  b: AssignmentTargetColumns,
): boolean {
  return (
    a.psychology_enabled === b.psychology_enabled &&
    (a.class_id ?? "") === (b.class_id ?? "") &&
    (a.specialization_id ?? "") === (b.specialization_id ?? "") &&
    (a.track_id ?? "") === (b.track_id ?? "")
  );
}

export function assignmentImportKey(
  academicYearId: string,
  row: {
    teacher_id: string;
    subject: string;
    lesson_name: string | null;
    year_group: number;
    grade_level: GradeLevel;
    teaching_mode: TeachingMode | null;
    assignment_category: AssignmentCategory;
  } & AssignmentTargetColumns,
): string {
  return [
    academicYearId,
    row.teacher_id,
    row.year_group,
    row.grade_level,
    row.subject,
    row.lesson_name ?? "",
    row.assignment_category,
    row.class_id ?? "",
    row.specialization_id ?? "",
    row.track_id ?? "",
    row.psychology_enabled ? "1" : "0",
    row.teaching_mode ?? "",
  ].join("\0");
}
