import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatGradeLabel } from "@/lib/academicYears/labels";
import { GRADE_LEVELS, type GradeLevel } from "@/lib/academicYears/types";
import { notDeleted } from "@/lib/db/softDelete";
import { isTeachingTrackName } from "@/lib/students/fields";
import { studentTeachingTypeMatches } from "@/lib/teachers/teachingMode";
import type { AssignmentCategory, TeachingMode, TeachingTrackType } from "@/lib/types/db";

export type AssignmentMultiTarget = {
  grade_levels: GradeLevel[];
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade: boolean;
};

export type AssignmentMultiTargetRow = AssignmentMultiTarget & {
  id: string;
  assignment_category?: AssignmentCategory;
};

export type MultiTargetInput = {
  grade_levels?: string[] | null;
  grade_level?: string | null;
  class_ids?: string[] | null;
  track_ids?: string[] | null;
  specialization_ids?: string[] | null;
  class_id?: string | null;
  track_id?: string | null;
  specialization_id?: string | null;
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
};

export function filterGradeLevels(raw: unknown[] | null | undefined): GradeLevel[] {
  if (!raw?.length) return [];
  const out: GradeLevel[] = [];
  for (const item of raw) {
    const s = String(item ?? "").trim();
    if ((GRADE_LEVELS as readonly string[]).includes(s) && !out.includes(s as GradeLevel)) {
      out.push(s as GradeLevel);
    }
  }
  return out;
}

export function uniqueIds(raw: string[] | null | undefined): string[] {
  return [...new Set((raw ?? []).map((id) => id.trim()).filter(Boolean))];
}

export function normalizeMultiTargetInput(raw: MultiTargetInput): AssignmentMultiTarget {
  const class_ids = uniqueIds([
    ...uniqueIds(raw.class_ids),
    ...(raw.class_id?.trim() ? [raw.class_id.trim()] : []),
  ]);
  const track_ids = uniqueIds([
    ...uniqueIds(raw.track_ids),
    ...(raw.track_id?.trim() ? [raw.track_id.trim()] : []),
  ]);
  const specialization_ids = uniqueIds([
    ...uniqueIds(raw.specialization_ids),
    ...(raw.specialization_id?.trim() ? [raw.specialization_id.trim()] : []),
  ]);

  return {
    grade_levels: filterGradeLevels([
      ...(raw.grade_levels ?? []),
      ...(raw.grade_level?.trim() ? [raw.grade_level.trim()] : []),
    ]),
    class_ids,
    track_ids,
    specialization_ids,
    psychology_enabled: Boolean(raw.psychology_enabled),
    applies_to_all_in_grade: Boolean(raw.applies_to_all_in_grade),
  };
}

export function validateMultiTarget(
  category: AssignmentCategory,
  target: AssignmentMultiTarget,
): string | null {
  if (!target.grade_levels.length) return "בחרי לפחות שכבה אחת";

  if (category === "התמחות") {
    if (!target.specialization_ids.length) return "בחרי לפחות התמחות אחת";
    if (target.class_ids.length || target.track_ids.length || target.psychology_enabled) {
      return "בשיבוץ התמחות — רק התמחויות";
    }
    if (target.applies_to_all_in_grade) return "«כל השכבה» לא רלוונטי להתמחות";
    return null;
  }

  if (target.specialization_ids.length) return "בשיבוץ חובה — אין לבחור התמחות";

  if (target.applies_to_all_in_grade) {
    if (target.class_ids.length || target.track_ids.length || target.psychology_enabled) {
      return "«כל השכבה» — בלי כיתות, מסלולים או פסיכולוגיה";
    }
    return null;
  }

  const hasTarget =
    target.psychology_enabled ||
    target.class_ids.length > 0 ||
    target.track_ids.length > 0;

  if (!hasTarget) return "בחרי לפחות יעד אחד: כיתה, מסלול, פסיכולוגיה, או «כל השכבה»";

  return null;
}

export function computeTargetsFingerprint(target: AssignmentMultiTarget): string {
  const sort = (arr: string[]) => [...arr].sort();
  const payload = JSON.stringify({
    g: sort(target.grade_levels),
    c: sort(target.class_ids),
    t: sort(target.track_ids),
    s: sort(target.specialization_ids),
    p: target.psychology_enabled,
    a: target.applies_to_all_in_grade,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export function formatGradeLevelsLabel(levels: GradeLevel[]): string {
  if (!levels.length) return "—";
  return levels.map((g) => formatGradeLabel(g).replace(/^שכבה\s*/, "")).join(", ");
}

export function multiTargetTypeLabel(
  target: AssignmentMultiTarget,
  category?: AssignmentCategory,
): string {
  if (category === "התמחות") return "התמחות";
  const parts: string[] = [];
  if (target.applies_to_all_in_grade) parts.push("כל השכבה");
  if (target.class_ids.length) parts.push("כיתות");
  if (target.track_ids.length) parts.push("מסלולים");
  if (target.psychology_enabled) parts.push("פסיכולוגיה");
  if (!parts.length) return category === "חובה" ? "חובה" : "—";
  return category === "חובה" ? `חובה · ${parts.join(" · ")}` : parts.join(" · ");
}

export async function resolveMultiTargetLabels(
  supabase: SupabaseClient,
  rows: AssignmentMultiTargetRow[],
): Promise<Record<string, string>> {
  const classIds = new Set<string>();
  const specIds = new Set<string>();
  const trackIds = new Set<string>();

  for (const r of rows) {
    r.class_ids.forEach((id) => classIds.add(id));
    r.specialization_ids.forEach((id) => specIds.add(id));
    r.track_ids.forEach((id) => trackIds.add(id));
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
    const gradePart = formatGradeLevelsLabel(r.grade_levels);
    const targetParts: string[] = [];

    if (r.applies_to_all_in_grade) targetParts.push("כל השכבה");
    if (r.psychology_enabled) targetParts.push("פסיכולוגיה");
    for (const id of r.class_ids) {
      targetParts.push(names.get(`class:${id}`) ?? id);
    }
    for (const id of r.track_ids) {
      targetParts.push(names.get(`track:${id}`) ?? id);
    }
    for (const id of r.specialization_ids) {
      targetParts.push(names.get(`spec:${id}`) ?? id);
    }

    labels[r.id] = targetParts.length
      ? `${gradePart} · ${targetParts.join(", ")}`
      : gradePart;
  }
  return labels;
}

export type MultiTargetScope = {
  academic_year_id: string;
};

async function studentIdsForGradeAndSlice(
  supabase: SupabaseClient,
  academicYearId: string,
  gradeLevel: GradeLevel,
  slice: Pick<
    AssignmentMultiTarget,
    "class_ids" | "track_ids" | "specialization_ids" | "psychology_enabled" | "applies_to_all_in_grade"
  >,
  options?: { teachingMode?: TeachingMode | null; category?: AssignmentCategory },
): Promise<{ ids: string[]; error: string | null }> {
  const ids = new Set<string>();

  if (slice.applies_to_all_in_grade) {
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", academicYearId)
      .eq("grade_level", gradeLevel);
    if (error) return { ids: [], error: error.message };
    for (const row of data ?? []) ids.add(row.id as string);
    return { ids: [...ids], error: null };
  }

  // מסלול הוראה הוא מסנן חוצה (intersection), לא יעד נוסף (union):
  // אם נבחר מסלול הוראה + סוג הוראה — התלמידות שיוחזרו חייבות להיות
  // על מסלול הוראה ולפי הסוג שנבחר. אם נבחרה גם כיתה — זה צמצום נוסף
  // (חיתוך), לא יעד שמתווסף לאוסף.
  if (options?.teachingMode && slice.track_ids.length === 1) {
    const { data: onlyTrack } = await supabase
      .from("tracks")
      .select("name")
      .eq("id", slice.track_ids[0])
      .maybeSingle();
    if (isTeachingTrackName((onlyTrack?.name as string) ?? "")) {
      let q = notDeleted(supabase.from("students").select("id"))
        .eq("academic_year_id", academicYearId)
        .eq("grade_level", gradeLevel)
        .eq("track_id", slice.track_ids[0]);
      const mode = options.teachingMode;
      if (mode === "full" || mode === "short") {
        q = q.eq("teaching_track_type", mode);
      } else if (mode === "both") {
        q = q.in("teaching_track_type", ["full", "short"]);
      }
      if (slice.class_ids.length) {
        q = q.in("class_id", slice.class_ids);
      }
      if (slice.psychology_enabled) {
        q = q.eq("is_psychology", true);
      }
      const { data, error } = await q;
      if (error) return { ids: [], error: error.message };
      for (const row of data ?? []) ids.add(row.id as string);
      return { ids: [...ids], error: null };
    }
  }

  const hasClassOrTrack = slice.class_ids.length > 0 || slice.track_ids.length > 0;

  // פסיכולוגיה לבד (בלי כיתה/מסלול) — מחזיר את כל תלמידות הפסיכולוגיה בשכבה
  if (slice.psychology_enabled && !hasClassOrTrack && !slice.specialization_ids.length) {
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", academicYearId)
      .eq("grade_level", gradeLevel)
      .eq("is_psychology", true);
    if (error) return { ids: [], error: error.message };
    for (const row of data ?? []) ids.add(row.id as string);
    return { ids: [...ids], error: null };
  }

  for (const classId of slice.class_ids) {
    const { data, error } = await notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", academicYearId)
      .eq("grade_level", gradeLevel)
      .eq("class_id", classId);
    if (error) return { ids: [], error: error.message };
    for (const row of data ?? []) ids.add(row.id as string);
  }

  for (const trackId of slice.track_ids) {
    const { data: trackRow } = await supabase
      .from("tracks")
      .select("name")
      .eq("id", trackId)
      .maybeSingle();
    let q = notDeleted(supabase.from("students").select("id"))
      .eq("academic_year_id", academicYearId)
      .eq("grade_level", gradeLevel)
      .eq("track_id", trackId);
    if (isTeachingTrackName((trackRow?.name as string) ?? "") && options?.teachingMode) {
      if (options.teachingMode === "full" || options.teachingMode === "short") {
        q = q.eq("teaching_track_type", options.teachingMode);
      } else if (options.teachingMode === "both") {
        q = q.in("teaching_track_type", ["full", "short"]);
      }
    }
    const { data, error } = await q;
    if (error) return { ids: [], error: error.message };
    for (const row of data ?? []) ids.add(row.id as string);
  }

  const category = options?.category;
  if (slice.specialization_ids.length || category === "התמחות") {
    for (const specId of slice.specialization_ids) {
      const { data, error } = await notDeleted(supabase.from("students").select("id"))
        .eq("academic_year_id", academicYearId)
        .eq("grade_level", gradeLevel)
        .or(`specialization_id.eq.${specId},secondary_specialization_id.eq.${specId}`);
      if (error) return { ids: [], error: error.message };
      for (const row of data ?? []) ids.add(row.id as string);
    }
  }

  // פסיכולוגיה כסינון: אם נבחרו גם כיתה/מסלול — מצמצמים את הקבוצה לרק
  // תלמידות פסיכולוגיה מתוך מי שהתאימה לכיתה/מסלול שנבחרו.
  if (slice.psychology_enabled && ids.size) {
    const { data, error } = await notDeleted(
      supabase.from("students").select("id"),
    )
      .eq("academic_year_id", academicYearId)
      .eq("is_psychology", true)
      .in("id", [...ids]);
    if (error) return { ids: [], error: error.message };
    const psychSet = new Set((data ?? []).map((r) => r.id as string));
    return { ids: [...ids].filter((id) => psychSet.has(id)), error: null };
  }

  return { ids: [...ids], error: null };
}

export async function fetchStudentIdsForMultiTarget(
  supabase: SupabaseClient,
  target: AssignmentMultiTarget,
  scope: MultiTargetScope,
  options?: { teachingMode?: TeachingMode | null; category?: AssignmentCategory },
): Promise<{ ids: string[]; error: string | null }> {
  const err = validateMultiTarget(options?.category ?? "חובה", target);
  if (err && options?.category) return { ids: [], error: err };

  const allIds = new Set<string>();
  for (const gradeLevel of target.grade_levels) {
    const result = await studentIdsForGradeAndSlice(
      supabase,
      scope.academic_year_id,
      gradeLevel,
      target,
      options,
    );
    if (result.error) return result;
    result.ids.forEach((id) => allIds.add(id));
  }

  return { ids: [...allIds], error: null };
}

export type AssignmentMultiSpec = {
  teacher_id: string;
  subject: string;
  lesson_name: string | null;
  assignment_category: AssignmentCategory;
  teaching_mode: TeachingTrackType | null;
} & AssignmentMultiTarget;

export function rowToMultiTarget(row: {
  grade_levels?: string[] | null;
  grade_level?: string | null;
  class_ids?: string[] | null;
  class_id?: string | null;
  track_ids?: string[] | null;
  track_id?: string | null;
  specialization_ids?: string[] | null;
  specialization_id?: string | null;
  psychology_enabled?: boolean;
  applies_to_all_in_grade?: boolean;
}): AssignmentMultiTarget {
  return normalizeMultiTargetInput({
    grade_levels: row.grade_levels ?? [],
    grade_level: row.grade_level,
    class_ids: row.class_ids ?? [],
    class_id: row.class_id,
    track_ids: row.track_ids ?? [],
    track_id: row.track_id,
    specialization_ids: row.specialization_ids ?? [],
    specialization_id: row.specialization_id,
    psychology_enabled: row.psychology_enabled,
    applies_to_all_in_grade: row.applies_to_all_in_grade,
  });
}

/** תווית שכבות ממבחן/שיבוץ — תומך גם בעמודה ישנה grade_level. */
export function examGradeLevelsLabel(row: {
  grade_levels?: string[] | null;
  grade_level?: string | null;
}): string {
  return formatGradeLevelsLabel(
    normalizeMultiTargetInput({
      grade_levels: row.grade_levels ?? [],
      grade_level: row.grade_level,
    }).grade_levels,
  );
}

/** מפתח ייחודיות לייבוא — לפי טביעת אצבע יעדים (לא שורה לכל שכבה). */
export function assignmentImportKey(
  academicYearId: string,
  row: AssignmentMultiSpec,
): string {
  const fingerprint = computeTargetsFingerprint(row);
  return [
    academicYearId,
    row.teacher_id,
    row.subject,
    row.lesson_name ?? "",
    row.assignment_category,
    fingerprint,
    row.teaching_mode ?? "",
  ].join("\0");
}
