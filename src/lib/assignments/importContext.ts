import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignmentImportKey,
  buildTeacherLookupMaps,
  type AssignmentImportMaps,
  type TeacherLookupMaps,
} from "@/lib/assignments/excelImport";
import { notDeleted } from "@/lib/db/softDelete";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { rowToMultiTarget } from "@/lib/assignments/multiTarget";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";

export type AssignmentImportContext = AssignmentImportMaps & {
  academicYearId: string;
  existingKeys: Set<string>;
};

export async function loadAssignmentImportContext(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<{ ctx: AssignmentImportContext } | { error: string }> {
  const [cl, sp, tr, teachersRes, existingRes] = await Promise.all([
    supabase
      .from("classes")
      .select("id,name")
      .eq("academic_year_id", academicYearId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("specializations")
      .select("id,name")
      .eq("academic_year_id", academicYearId)
      .eq("is_active", true)
      .is("deleted_at", null),
    supabase
      .from("tracks")
      .select("id,name")
      .eq("academic_year_id", academicYearId)
      .eq("is_active", true)
      .is("deleted_at", null),
    notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS)).eq(
      "academic_year_id",
      academicYearId,
    ),
    notDeleted(
      supabase.from("teacher_assignments").select(
        "teacher_id,grade_levels,subject,lesson_name,assignment_category,class_ids,track_ids,specialization_ids,psychology_enabled,applies_to_all_in_grade,teaching_mode",
      ),
    ).eq("academic_year_id", academicYearId),
  ]);

  for (const res of [cl, sp, tr, teachersRes, existingRes]) {
    if (res.error) return { error: res.error.message };
  }

  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackNameById = new Map((tr.data ?? []).map((r) => [r.id, r.name.trim()] as const));
  const teacherMaps: TeacherLookupMaps = buildTeacherLookupMaps(teachersRes.data ?? []);

  const existingKeys = new Set(
    (existingRes.data ?? []).map((a) =>
      assignmentImportKey(academicYearId, {
        teacher_id: a.teacher_id,
        subject: a.subject.trim(),
        lesson_name: (a.lesson_name as string | null) ?? null,
        teaching_mode: (a.teaching_mode as TeachingTrackType | null) ?? null,
        assignment_category: a.assignment_category as AssignmentCategory,
        ...rowToMultiTarget(a as Parameters<typeof rowToMultiTarget>[0]),
      }),
    ),
  );

  return {
    ctx: {
      academicYearId,
      teacherMaps,
      classByName,
      specByName,
      trackByName,
      trackNameById,
      existingKeys,
    },
  };
}

export function formatAssignmentImportInsertError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("wrong school year") || m.includes("class_id invalid")) {
    return "כיתה/מסלול/התמחות לא שייכים לשנה הנבחרת — ודאי שהלוקאפים והמורות מאותה שנת לימודים";
  }
  if (m.includes("specialization_id invalid")) {
    return "התמחות לא שייכת לשנה הנבחרת";
  }
  if (m.includes("track_id invalid")) {
    return "מסלול לא שייך לשנה הנבחרת";
  }
  if (m.includes("uq_teacher_assignment") || m.includes("duplicate key")) {
    return "שיבוץ כפול — כבר קיים במערכת";
  }
  if (m.includes("assignment_category") && m.includes("does not exist")) {
    return "סכמת שיבוצים לא מעודכנת — הריצי supabase/PATCH_ALL_FOR_EXISTING_DB.sql ב-Supabase";
  }
  if (m.includes("teacher_assignments_category_target_check")) {
    return "יעד שיבוץ לא תקין — בדקי סוג שיבוץ (חובה/התמחות) וכיתה/מסלול/התמחות";
  }
  return message;
}
