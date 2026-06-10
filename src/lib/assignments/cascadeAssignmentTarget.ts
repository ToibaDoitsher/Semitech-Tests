import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeTargetsFingerprint,
  type AssignmentMultiTarget,
} from "@/lib/assignments/multiTarget";
import { syncExamStudentsToTarget } from "@/lib/exams/syncExamStudents";
import type { AssignmentCategory } from "@/lib/types/db";

export type CascadeAssignmentTargetResult = {
  /** מספר המבחנים שהיעד שלהם עודכן בפועל */
  examsTargetUpdated: number;
  /** מספר המבחנים שדילגנו עליהם כי כבר ננעלו (יצירת השלמות) */
  examsSkippedLocked: number;
  /** סה״כ תלמידות שנוספו לכל המבחנים */
  studentsAdded: number;
  /** סה״כ שורות exam_students שנמחקו (תלמידות שיצאו מהיעד) */
  studentsRemoved: number;
  /** סה״כ רשומות השלמה שנמחקו (cascade) */
  makeupsRemoved: number;
  /** סה״כ רשומות מעקב-השלמה שנמחקו (cascade) */
  trackingRemoved: number;
};

/**
 * אחרי שהשיבוץ עודכן (יעד / קטגוריה / סוג הוראה) — מחילים את היעד
 * החדש על כל המבחנים שהשיבוץ הזה יצר, ומסנכרנים את התלמידות שלהם.
 *
 * - לא נוגעים במבחן שננעל כבר (makeup_locked_at) — כי כבר נוצרו לו
 *   השלמות ושינוי היעד עלול להשאיר רשומות יתומות.
 * - לא משנים את תאריך המבחן, את המקצוע ואת המורה — רק את שדות היעד.
 */
export async function cascadeAssignmentTargetToExams(
  supabase: SupabaseClient,
  assignmentId: string,
  newTarget: AssignmentMultiTarget,
  newCategory: AssignmentCategory,
  newTeachingTrackType: "full" | "short" | null,
): Promise<CascadeAssignmentTargetResult | { error: string }> {
  const { data: examsRaw, error: examsErr } = await supabase
    .from("exams")
    .select(
      "id, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, assignment_category, teaching_track_type, makeup_locked_at",
    )
    .eq("teacher_assignment_id", assignmentId)
    .is("deleted_at", null);
  if (examsErr) return { error: examsErr.message };

  const exams = (examsRaw ?? []) as Array<{
    id: string;
    grade_levels: string[];
    class_ids: string[];
    track_ids: string[];
    specialization_ids: string[];
    psychology_enabled: boolean;
    applies_to_all_in_grade: boolean;
    assignment_category: AssignmentCategory;
    teaching_track_type: "full" | "short" | null;
    makeup_locked_at: string | null;
  }>;

  let examsTargetUpdated = 0;
  let examsSkippedLocked = 0;
  let studentsAdded = 0;
  let studentsRemoved = 0;
  let makeupsRemoved = 0;
  let trackingRemoved = 0;

  const newFingerprint = computeTargetsFingerprint(newTarget);

  for (const exam of exams) {
    if (exam.makeup_locked_at) {
      examsSkippedLocked += 1;
      continue;
    }

    const currentFingerprint = computeTargetsFingerprint({
      grade_levels: (exam.grade_levels ?? []) as AssignmentMultiTarget["grade_levels"],
      class_ids: exam.class_ids ?? [],
      track_ids: exam.track_ids ?? [],
      specialization_ids: exam.specialization_ids ?? [],
      psychology_enabled: Boolean(exam.psychology_enabled),
      applies_to_all_in_grade: Boolean(exam.applies_to_all_in_grade),
    });

    const targetSame = currentFingerprint === newFingerprint;
    const categorySame = exam.assignment_category === newCategory;
    const teachingSame = (exam.teaching_track_type ?? null) === newTeachingTrackType;

    if (targetSame && categorySame && teachingSame) continue;

    const { error: updErr } = await supabase
      .from("exams")
      .update({
        grade_levels: newTarget.grade_levels,
        class_ids: newTarget.class_ids,
        track_ids: newTarget.track_ids,
        specialization_ids: newTarget.specialization_ids,
        psychology_enabled: newTarget.psychology_enabled,
        applies_to_all_in_grade: newTarget.applies_to_all_in_grade,
        assignment_category: newCategory,
        teaching_track_type: newTeachingTrackType,
      })
      .eq("id", exam.id);
    if (updErr) return { error: updErr.message };
    examsTargetUpdated += 1;

    const syncResult = await syncExamStudentsToTarget(supabase, exam.id);
    if ("error" in syncResult) return { error: syncResult.error };
    studentsAdded += syncResult.added;
    studentsRemoved += syncResult.removedExamStudents;
    makeupsRemoved += syncResult.removedMakeups;
    trackingRemoved += syncResult.removedTracking;
  }

  return {
    examsTargetUpdated,
    examsSkippedLocked,
    studentsAdded,
    studentsRemoved,
    makeupsRemoved,
    trackingRemoved,
  };
}
