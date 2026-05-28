import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";
import {
  fetchStudentIdsForMultiTarget,
  rowToMultiTarget,
  validateMultiTarget,
} from "@/lib/assignments/multiTarget";
import { isTeachingTrackId } from "@/lib/exams/logic";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { buildExamStudentRows } from "@/lib/exams/snapshots";
import type { AssignmentCategory, TeachingMode, TeachingTrackType } from "@/lib/types/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import {
  isTeachingModeValue,
  isTeachingSelectionComplete,
  teachingModeToExamDb,
  type TeachingModeSelection,
} from "@/lib/teachers/teachingMode";
import { notDeleted } from "@/lib/db/softDelete";

export type CreateOneExamParams = {
  supabase: SupabaseClient;
  academicYearId: string;
  academicYearName: string;
  teacherId: string;
  subject: string;
  examDate: string;
  assignmentId: string;
  teachingMode: TeachingMode | null;
  auditUserId: string | null;
};

function resolveTeachingSelection(
  fromRequest: TeachingMode | null,
  fromAssignment: TeachingTrackType | null,
  hasTeachingTrack: boolean,
): TeachingMode | null {
  if (isTeachingModeValue(fromRequest)) return fromRequest;
  if (fromAssignment === "full" || fromAssignment === "short") return fromAssignment;
  if (hasTeachingTrack && fromAssignment == null) return "both";
  return null;
}

export async function createOneExam(
  params: CreateOneExamParams,
): Promise<{ exam: Record<string, unknown>; students_count: number } | { error: string }> {
  const {
    supabase,
    academicYearId,
    academicYearName,
    teacherId,
    subject,
    examDate,
    assignmentId,
    teachingMode: teachingModeIn,
    auditUserId,
  } = params;

  const { data: ta } = await supabase
    .from("teacher_assignments")
    .select(
      "id, academic_year_id, grade_levels, teacher_id, subject, assignment_category, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, teaching_mode, lesson_name, deleted_at",
    )
    .eq("id", assignmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!ta) return { error: "שיבוץ לא נמצא" };
  if (ta.academic_year_id !== academicYearId) {
    return { error: "שיבוץ לא שייך לשנה הנוכחית" };
  }
  if (ta.teacher_id !== teacherId || ta.subject !== subject) {
    return { error: "שיבוץ לא תואם למורה/מקצוע" };
  }

  const multiTarget = rowToMultiTarget(ta);
  const examCategory = ta.assignment_category as AssignmentCategory;

  const targetErr = validateMultiTarget(examCategory, multiTarget);
  if (targetErr) return { error: targetErr };

  const dup = await notDeleted(supabase.from("exams").select("id"))
    .eq("teacher_assignment_id", assignmentId)
    .eq("exam_date", examDate)
    .limit(1);
  if (dup.error) return { error: dup.error.message };
  if (dup.data?.length) {
    return { error: "כבר קיים מבחן לאותו שיבוץ באותו תאריך" };
  }

  const assignmentTeachingMode = (ta.teaching_mode as TeachingTrackType | null) ?? null;

  let hasTeachingTrack = false;
  if (multiTarget.track_ids.length) {
    const checks = await Promise.all(
      multiTarget.track_ids.map((id) => isTeachingTrackId(supabase, id)),
    );
    hasTeachingTrack = checks.some(Boolean);
  }

  const teachingSelection = resolveTeachingSelection(
    teachingModeIn,
    assignmentTeachingMode,
    hasTeachingTrack,
  );
  const teaching_track_type: TeachingTrackType | null = teachingSelection
    ? teachingModeToExamDb(teachingSelection as TeachingModeSelection)
    : null;

  if (hasTeachingTrack && !isTeachingSelectionComplete(teachingSelection)) {
    return { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" };
  }

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForMultiTarget(
    supabase,
    multiTarget,
    { academic_year_id: academicYearId },
    {
      teachingMode: hasTeachingTrack ? teachingSelection : null,
      category: examCategory,
    },
  );
  if (stErr) return { error: stErr };
  if (!studentIds.length) {
    // הודעה ממוקדת — במיוחד כשמדובר במסלול הוראה + כיתה, כי הסינון
    // הוא חיתוך והפער בנתונים יכול להפתיע
    if (hasTeachingTrack && multiTarget.class_ids.length) {
      const { count: classInGradeCount } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", multiTarget.class_ids)
        .in("grade_level", multiTarget.grade_levels)
        .is("deleted_at", null);
      const { count: teachingInGradeCount } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("track_id", multiTarget.track_ids)
        .in("grade_level", multiTarget.grade_levels)
        .is("deleted_at", null);
      const gradeLabel = multiTarget.grade_levels.join(", ");
      if (!classInGradeCount) {
        return {
          error: `הכיתה שנבחרה ריקה בשכבה ${gradeLabel}. הסירי את הכיתה (כדי לקבל את כל תלמידות מסלול הוראה בשכבה) או בחרי כיתה אחרת.`,
        };
      }
      if (!teachingInGradeCount) {
        return {
          error: `אין תלמידות במסלול הוראה בשכבה ${gradeLabel}. הסירי את מסלול ההוראה או הוסיפי תלמידות למסלול בכרטיסי התלמידות.`,
        };
      }
      return {
        error: `אין תלמידות מסלול הוראה בכיתה שנבחרה בשכבה ${gradeLabel}. תלמידות מסלול הוראה בשכבה זו נמצאות בכיתות אחרות — שני את הכיתה או הסירי אותה.`,
      };
    }
    return { error: "לא נמצאו תלמידות לפי היעד והשכבות" };
  }

  const insertRow: Record<string, unknown> = {
    academic_year_id: academicYearId,
    teacher_id: teacherId,
    subject,
    exam_date: examDate,
    assignment_category: examCategory,
    grade_levels: multiTarget.grade_levels,
    class_ids: multiTarget.class_ids,
    track_ids: multiTarget.track_ids,
    specialization_ids: multiTarget.specialization_ids,
    psychology_enabled: multiTarget.psychology_enabled,
    applies_to_all_in_grade: multiTarget.applies_to_all_in_grade,
    teacher_assignment_id: assignmentId,
  };
  if (hasTeachingTrack) insertRow.teaching_track_type = teaching_track_type;

  const { data: exam, error: eErr } = await supabase.from("exams").insert(insertRow).select("*").single();
  if (eErr || !exam) return { error: eErr?.message ?? "שגיאה ביצירת מבחן" };

  const examId = exam.id as string;

  async function rollbackExam(): Promise<void> {
    await supabase.from("makeup_tracking").delete().eq("exam_id", examId);
    await supabase.from("makeup_exams").delete().eq("exam_id", examId);
    await supabase.from("exam_students").delete().eq("exam_id", examId);
    await supabase.from("exam_tracking").delete().eq("exam_id", examId);
    await supabase.from("exams").delete().eq("id", examId);
  }

  const { error: trErr } = await supabase.from("exam_tracking").insert({
    exam_id: examId,
    teacher_id: teacherId,
    academic_year_id: academicYearId,
  });
  if (trErr) {
    await rollbackExam();
    return { error: trErr.message };
  }

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("first_name, last_name, full_name_generated")
    .eq("id", teacherId)
    .single();
  const teacherName = teacherEmbedDisplayName(teacherRow);

  const targetLabels = await resolveExamTargetLabels(supabase, [
    { id: examId, ...multiTarget },
  ]);

  const fallbackGrade = multiTarget.grade_levels[0] ?? "א";
  const rows = await buildExamStudentRows(supabase, {
    examId,
    studentIds,
    teacherName,
    subject,
    fallbackGradeLevel: fallbackGrade,
    academicYearName,
    targetName: targetLabels[examId] ?? null,
  });

  const { error: esErr } = await supabase.from("exam_students").insert(rows);
  if (esErr) {
    await rollbackExam();
    return { error: esErr.message };
  }

  await writeAudit(supabase, {
    userId: auditUserId,
    entityType: "exam",
    entityId: examId,
    actionType: "create",
    entityNameSnapshot: subject,
    newValue: {
      teacher_id: teacherId,
      subject,
      exam_date: examDate,
      ...multiTarget,
      teacher_assignment_id: assignmentId,
      teaching_mode: teachingSelection,
    },
  });

  return { exam: exam as Record<string, unknown>, students_count: studentIds.length };
}
