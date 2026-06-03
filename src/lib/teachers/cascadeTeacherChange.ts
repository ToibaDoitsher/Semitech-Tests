import type { SupabaseClient } from "@supabase/supabase-js";
import { teacherDisplayName } from "@/lib/teachers/display";

export type CascadeTeacherResult = {
  examsUpdated: number;
  snapshotsUpdated: number;
  newTeacherName: string;
};

/**
 * כשמשנים מורה — בין אם זה דרך השיבוץ ובין אם דרך מבחן בודד —
 * צריך להחיל את השינוי על:
 *   1) כל המבחנים שמקושרים לאותו שיבוץ (teacher_assignment_id)
 *   2) כל ה-exam_students שלהם (העתק של שם המורה ב-teacher_snapshot)
 *
 * הפונקציה הזו מקבלת assignment_id ו-teacher_id חדש, ומחילה את שניהם.
 * היא לא נוגעת בשיבוץ עצמו — מי שקורא לה אחראי לעדכן אותו (כדי לאפשר
 * לתעד את ההבדל בין "עדכון יזום של השיבוץ" ל-"עדכון cascade מהמבחן").
 */
export async function cascadeTeacherForAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  newTeacherId: string,
): Promise<CascadeTeacherResult | { error: string }> {
  const { data: teacherRow, error: teacherErr } = await supabase
    .from("teachers")
    .select("id, first_name, last_name, full_name_generated, tz")
    .eq("id", newTeacherId)
    .maybeSingle();
  if (teacherErr) return { error: teacherErr.message };
  if (!teacherRow) return { error: "מורה חדשה לא נמצאה" };

  const newTeacherName = teacherDisplayName(teacherRow);

  const { data: examRows, error: examErr } = await supabase
    .from("exams")
    .select("id, teacher_id")
    .eq("teacher_assignment_id", assignmentId);
  if (examErr) return { error: examErr.message };

  const examsToUpdate = (examRows ?? []).filter(
    (r) => (r as { teacher_id: string }).teacher_id !== newTeacherId,
  );
  const examIds = examsToUpdate.map((r) => (r as { id: string }).id);

  let examsUpdated = 0;
  if (examIds.length) {
    const { error: updExamsErr, count } = await supabase
      .from("exams")
      .update({ teacher_id: newTeacherId }, { count: "exact" })
      .in("id", examIds);
    if (updExamsErr) return { error: updExamsErr.message };
    examsUpdated = count ?? examIds.length;
  }

  let snapshotsUpdated = 0;
  if (examIds.length) {
    const { error: snapErr, count } = await supabase
      .from("exam_students")
      .update({ teacher_snapshot: newTeacherName }, { count: "exact" })
      .in("exam_id", examIds);
    if (snapErr) {
      console.warn(
        "[cascadeTeacherForAssignment] לא הצלחתי לעדכן teacher_snapshot:",
        snapErr.message,
      );
    } else {
      snapshotsUpdated = count ?? 0;
    }
  }

  return { examsUpdated, snapshotsUpdated, newTeacherName };
}
